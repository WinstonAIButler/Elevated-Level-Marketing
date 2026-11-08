import "server-only";
import type { CrmProvider } from "@prisma/client";
import { fetchJson } from "../publishers/http";
import { parseDate, parseStatus, type LeadStatusValue } from "../leads-core";

// The five CRM connectors. Elevated never imports a client's customer list. It sends
// each lead it brings in to the client's CRM (or finds the record if the person is
// already there), keeps that record's id, and follows only that record: its stage and
// any deals / jobs / invoices linked to it, so we can see when it became a sale.
// API docs: developers.hubspot.com, developers.pipedrive.com, zoho.com/crm/developer,
// developer.getjobber.com, docs.housecallpro.com.

export type CrmConn = { provider: CrmProvider; token: string; extra: Record<string, any> };
export type PushLead = { name: string; email: string | null; phone: string | null; company: string | null; source: string; notes: string | null };
export type Tracked = { status: LeadStatusValue; valueCents: number; wonAt: Date | null; stage: string | null };

export type CrmConnector = {
  name: string;
  /** How clients connect: paste a key, sign in (OAuth), or either. */
  methods: ("token" | "oauth")[];
  tokenLabel?: string;
  tokenSteps?: string[];
  verify(c: CrmConn): Promise<{ accountName: string }>;
  /** Creates the lead in the CRM, or returns the existing record for the same email. Returns the CRM's id. */
  push?(c: CrmConn, lead: PushLead): Promise<string | null>;
  /** Finds a record by email when we can't create one (import-only CRMs). */
  find?(c: CrmConn, email: string): Promise<string | null>;
  /** Where that one record stands now. */
  track(c: CrmConn, externalId: string): Promise<Tracked>;
};

const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return { first: parts.length > 1 ? parts.slice(0, -1).join(" ") : "", last: parts[parts.length - 1] };
};

type Deal = { status: "WON" | "LOST" | "OPEN"; cents: number; at: Date | null; stage?: string | null };

/** Combines a record's own stage with its deals/jobs: any won deal makes it a sale (values add up). */
function combine(recordStatus: LeadStatusValue, stage: string | null, deals: Deal[]): Tracked {
  const won = deals.filter((d) => d.status === "WON");
  if (won.length) {
    const wonAt = won.map((d) => d.at).filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date();
    return { status: "WON", valueCents: won.reduce((a, d) => a + d.cents, 0), wonAt, stage: won[0].stage ?? stage ?? "Won" };
  }
  if (deals.some((d) => d.status === "OPEN")) return { status: recordStatus === "LOST" ? "LOST" : "CONTACTED", valueCents: 0, wonAt: null, stage: deals.find((d) => d.status === "OPEN")?.stage ?? stage };
  if (deals.length && deals.every((d) => d.status === "LOST")) return { status: "LOST", valueCents: 0, wonAt: null, stage: deals[0].stage ?? stage ?? "Lost" };
  return { status: recordStatus, valueCents: 0, wonAt: recordStatus === "WON" ? new Date() : null, stage };
}

// ---------------------------------------------------------------------------
// HubSpot

const hs = (c: CrmConn, path: string, init: RequestInit = {}) =>
  fetchJson<any>(`https://api.hubapi.com${path}`, { ...init, headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });

async function hubspotFind(c: CrmConn, email: string) {
  const res = await hs(c, "/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }], limit: 1 }),
  });
  return res.results?.[0]?.id ?? null;
}

const hubspot: CrmConnector = {
  name: "HubSpot",
  methods: ["token", "oauth"],
  tokenLabel: "Private app access token",
  tokenSteps: [
    "In HubSpot, go to Settings → Integrations → Private Apps → Create a private app (name it “Elevated”).",
    "Under Scopes, tick crm.objects.contacts.read, crm.objects.contacts.write and crm.objects.deals.read.",
    "Create the app, then copy its access token (starts with pat-) and paste it here.",
  ],
  async verify(c) {
    const info = await hs(c, "/account-info/v3/details").catch(() => null);
    await hs(c, "/crm/v3/objects/contacts?limit=1");
    return { accountName: info?.portalId ? `HubSpot account ${info.portalId}` : "HubSpot" };
  },
  async push(c, lead) {
    if (lead.email) {
      const existing = await hubspotFind(c, lead.email);
      if (existing) return existing;
    }
    const { first, last } = splitName(lead.name);
    const res = await hs(c, "/crm/v3/objects/contacts", {
      method: "POST",
      body: JSON.stringify({ properties: { firstname: first, lastname: last, email: lead.email ?? undefined, phone: lead.phone ?? undefined, company: lead.company ?? undefined, hs_lead_status: "NEW" } }),
    });
    return res.id ?? null;
  },
  find: hubspotFind,
  async track(c, id) {
    const contact = await hs(c, `/crm/v3/objects/contacts/${id}?properties=lifecyclestage,hs_lead_status&associations=deals`);
    const stage = String(contact.properties?.lifecyclestage ?? "");
    const leadStatus = String(contact.properties?.hs_lead_status ?? "");
    const dealIds: string[] = (contact.associations?.deals?.results ?? []).map((d: any) => d.id);
    let deals: Deal[] = [];
    if (dealIds.length) {
      const res = await hs(c, "/crm/v3/objects/deals/batch/read", {
        method: "POST",
        body: JSON.stringify({ properties: ["amount", "hs_is_closed_won", "hs_is_closed", "closedate", "dealstage"], inputs: dealIds.slice(0, 100).map((x) => ({ id: x })) }),
      });
      deals = (res.results ?? []).map((d: any) => ({
        status: d.properties.hs_is_closed_won === "true" ? "WON" : d.properties.hs_is_closed === "true" ? "LOST" : "OPEN",
        cents: Math.round(Number(d.properties.amount || 0) * 100),
        at: parseDate(d.properties.closedate),
        stage: d.properties.dealstage ?? null,
      }));
    }
    const own: LeadStatusValue = stage === "customer" ? "WON" : /UNQUALIFIED|BAD_TIMING/.test(leadStatus) ? "LOST" : leadStatus && leadStatus !== "NEW" ? "CONTACTED" : /opportunity|salesqualified/.test(stage) ? "CONTACTED" : "NEW";
    return combine(own, leadStatus || stage || null, deals);
  },
};

// ---------------------------------------------------------------------------
// Pipedrive

function pd(c: CrmConn, path: string, init: RequestInit = {}) {
  const oauth = c.extra.method === "oauth";
  const base = oauth ? `${c.extra.apiDomain}/api/v1` : "https://api.pipedrive.com/v1";
  const sep = path.includes("?") ? "&" : "?";
  const url = oauth ? `${base}${path}` : `${base}${path}${sep}api_token=${encodeURIComponent(c.token)}`;
  return fetchJson<any>(url, { ...init, headers: { "Content-Type": "application/json", ...(oauth ? { Authorization: `Bearer ${c.token}` } : {}), ...(init.headers ?? {}) } });
}

async function pipedriveFind(c: CrmConn, email: string) {
  const res = await pd(c, `/persons/search?term=${encodeURIComponent(email)}&fields=email&exact_match=true&limit=1`);
  const id = res.data?.items?.[0]?.item?.id;
  return id ? String(id) : null;
}

const pipedrive: CrmConnector = {
  name: "Pipedrive",
  methods: ["token", "oauth"],
  tokenLabel: "Personal API token",
  tokenSteps: ["In Pipedrive, click your profile picture → Personal preferences → API.", "Copy your personal API token and paste it here."],
  async verify(c) {
    const me = await pd(c, "/users/me");
    return { accountName: me.data?.company_name ? `${me.data.company_name} (Pipedrive)` : "Pipedrive" };
  },
  async push(c, lead) {
    if (lead.email) {
      const existing = await pipedriveFind(c, lead.email);
      if (existing) return existing;
    }
    const res = await pd(c, "/persons", {
      method: "POST",
      body: JSON.stringify({
        name: lead.name,
        ...(lead.email ? { email: [{ value: lead.email, primary: true, label: "work" }] } : {}),
        ...(lead.phone ? { phone: [{ value: lead.phone, primary: true, label: "mobile" }] } : {}),
      }),
    });
    return res.data?.id ? String(res.data.id) : null;
  },
  find: pipedriveFind,
  async track(c, id) {
    const res = await pd(c, `/persons/${id}/deals?status=all_not_deleted&limit=100`);
    const deals: Deal[] = (res.data ?? []).map((d: any) => ({
      status: d.status === "won" ? "WON" : d.status === "lost" ? "LOST" : "OPEN",
      cents: Math.round(Number(d.value || 0) * 100),
      at: parseDate(d.won_time ?? d.close_time),
      stage: d.status === "open" ? `Deal open: ${d.title}` : `Deal ${d.status}`,
    }));
    return combine("NEW", null, deals);
  },
};

// ---------------------------------------------------------------------------
// Zoho CRM (sign-in only). We create a Lead; when the client converts it, Zoho turns
// it into a Contact (+ Deal), so we follow the person by email from then on.

const ZOHO_VERSION = process.env.ZOHO_CRM_API_VERSION || "v7";
const zo = (c: CrmConn, path: string, init: RequestInit = {}) =>
  fetchJson<any>(`${c.extra.apiDomain || "https://www.zohoapis.com"}/crm/${ZOHO_VERSION}${path}`, {
    ...init,
    headers: { Authorization: `Zoho-oauthtoken ${c.token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

async function zohoSearch(c: CrmConn, module: string, email: string) {
  const res = await zo(c, `/${module}/search?email=${encodeURIComponent(email)}`).catch(() => null);
  return res?.data?.[0]?.id ? String(res.data[0].id) : null;
}

const zoho: CrmConnector = {
  name: "Zoho CRM",
  methods: ["oauth"],
  async verify(c) {
    const org = await zo(c, "/org").catch(() => null);
    return { accountName: org?.org?.[0]?.company_name ? `${org.org[0].company_name} (Zoho CRM)` : "Zoho CRM" };
  },
  async push(c, lead) {
    if (lead.email) {
      const contact = await zohoSearch(c, "Contacts", lead.email);
      if (contact) return `contact:${contact}:${lead.email}`;
      const existing = await zohoSearch(c, "Leads", lead.email);
      if (existing) return `lead:${existing}:${lead.email}`;
    }
    const { first, last } = splitName(lead.name);
    const res = await zo(c, "/Leads", {
      method: "POST",
      body: JSON.stringify({
        data: [{ First_Name: first || undefined, Last_Name: last, Email: lead.email ?? undefined, Phone: lead.phone ?? undefined, Company: lead.company ?? undefined, Description: `Lead from Elevated (source: ${lead.source})${lead.notes ? `\n${lead.notes}` : ""}` }],
      }),
    });
    const id = res?.data?.[0]?.details?.id;
    return id ? `lead:${id}:${lead.email ?? ""}` : null;
  },
  async track(c, externalId) {
    const [kind, id, email] = externalId.split(":");
    if (kind === "lead") {
      const lead = await zo(c, `/Leads/${id}?fields=Lead_Status`).catch(() => null);
      const row = lead?.data?.[0];
      if (row) {
        const st = row.Lead_Status ?? null;
        return { status: parseStatus(st), valueCents: 0, wonAt: null, stage: st };
      }
    }
    // Converted (or was a contact all along): follow the contact's deals.
    const contactId = kind === "contact" ? id : email ? await zohoSearch(c, "Contacts", email) : null;
    if (!contactId) return { status: "LOST", valueCents: 0, wonAt: null, stage: "No longer in Zoho" };
    const res = await zo(c, `/Contacts/${contactId}/Deals?fields=Stage,Amount,Closing_Date`).catch(() => null);
    const deals: Deal[] = (res?.data ?? []).map((d: any) => ({
      status: /closed.?won/i.test(d.Stage ?? "") ? "WON" : /closed.?lost/i.test(d.Stage ?? "") ? "LOST" : "OPEN",
      cents: Math.round(Number(d.Amount || 0) * 100),
      at: parseDate(d.Closing_Date),
      stage: d.Stage ?? null,
    }));
    return combine("CONTACTED", "Converted to contact", deals);
  },
};

// ---------------------------------------------------------------------------
// Jobber (sign-in only; GraphQL). We don't create clients in Jobber; we find the
// person by email once the client adds them, then follow their invoices.

const JOBBER_VERSION = process.env.JOBBER_API_VERSION || "2025-01-20";
async function jb(c: CrmConn, query: string, variables: Record<string, unknown> = {}) {
  const res = await fetchJson<any>("https://api.getjobber.com/api/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json", "X-JOBBER-GRAPHQL-VERSION": JOBBER_VERSION },
    body: JSON.stringify({ query, variables }),
  });
  if (res.errors?.length) throw new Error(`Jobber: ${res.errors.map((e: any) => e.message).join("; ")}`);
  return res.data;
}

const jobber: CrmConnector = {
  name: "Jobber",
  methods: ["oauth"],
  async verify(c) {
    const d = await jb(c, "query { account { name } }");
    return { accountName: d?.account?.name ? `${d.account.name} (Jobber)` : "Jobber" };
  },
  async find(c, email) {
    const d = await jb(c, `query($q: String) { clients(first: 5, searchTerm: $q) { nodes { id emails { address } } } }`, { q: email });
    const hit = d.clients.nodes.find((n: any) => n.emails?.some((e: any) => e.address?.toLowerCase() === email.toLowerCase()));
    return hit?.id ?? null;
  },
  async track(c, id) {
    const d = await jb(c, `query($id: EncodedId!) { client(id: $id) { invoices(first: 50) { nodes { invoiceStatus issuedDate amounts { total } } } jobs(first: 20) { nodes { jobStatus } } } }`, { id });
    const deals: Deal[] = (d.client?.invoices?.nodes ?? []).map((n: any) => {
      const s = String(n.invoiceStatus ?? "").toLowerCase();
      return { status: s === "paid" ? "WON" : /bad_debt|void/.test(s) ? "LOST" : "OPEN", cents: Math.round(Number(n.amounts?.total ?? 0) * 100), at: parseDate(n.issuedDate), stage: `Invoice ${s}` };
    });
    const hasJobs = (d.client?.jobs?.nodes ?? []).length > 0;
    return combine(hasJobs ? "CONTACTED" : "NEW", hasJobs ? "Job scheduled" : "Client added", deals);
  },
};

// ---------------------------------------------------------------------------
// Housecall Pro (API key; requires their MAX plan)

const hcp = (c: CrmConn, path: string, init: RequestInit = {}) =>
  fetchJson<any>(`https://api.housecallpro.com${path}`, {
    ...init,
    headers: { Authorization: `Token ${c.token}`, Accept: "application/json", "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

async function hcpFind(c: CrmConn, email: string) {
  const res = await hcp(c, `/customers?q=${encodeURIComponent(email)}&page_size=5`);
  const hit = (res.customers ?? []).find((x: any) => String(x.email ?? "").toLowerCase() === email.toLowerCase());
  return hit?.id ?? null;
}

const housecallPro: CrmConnector = {
  name: "Housecall Pro",
  methods: ["token"],
  tokenLabel: "API key",
  tokenSteps: ["In Housecall Pro, go to My Apps → App Store → API (requires the MAX plan).", "Generate an API key and paste it here."],
  async verify(c) {
    const co = await hcp(c, "/company").catch(() => null);
    await hcp(c, "/customers?page=1&page_size=1");
    return { accountName: co?.name ? `${co.name} (Housecall Pro)` : "Housecall Pro" };
  },
  async push(c, lead) {
    if (lead.email) {
      const existing = await hcpFind(c, lead.email);
      if (existing) return existing;
    }
    const { first, last } = splitName(lead.name);
    const res = await hcp(c, "/customers", {
      method: "POST",
      body: JSON.stringify({ first_name: first || last, last_name: first ? last : "", email: lead.email ?? undefined, mobile_number: lead.phone ?? undefined, company: lead.company ?? undefined, lead_source: "Elevated", notifications_enabled: false }),
    });
    return res?.id ?? null;
  },
  find: hcpFind,
  async track(c, id) {
    const res = await hcp(c, `/jobs?customer_id=${encodeURIComponent(id)}&page_size=50`);
    const deals: Deal[] = (res.jobs ?? []).map((j: any) => {
      const s = String(j.work_status ?? "").toLowerCase();
      return { status: /complete/.test(s) ? "WON" : /cancel/.test(s) ? "LOST" : "OPEN", cents: Math.round(Number(j.total_amount ?? 0)), at: parseDate(j.work_timestamps?.completed_at ?? j.created_at), stage: `Job ${s.replace(/_/g, " ")}` };
    });
    return combine("NEW", null, deals);
  },
};

export const CONNECTORS: Record<CrmProvider, CrmConnector> = {
  HUBSPOT: hubspot,
  PIPEDRIVE: pipedrive,
  ZOHO: zoho,
  JOBBER: jobber,
  HOUSECALL_PRO: housecallPro,
};
