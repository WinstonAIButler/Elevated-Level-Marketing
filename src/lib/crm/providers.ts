import "server-only";
import type { CrmProvider } from "@prisma/client";
import { fetchJson } from "../publishers/http";
import { normalizeSource, parseDate, parseStatus, type Channel, type LeadDraft } from "../leads-core";

// The five CRM connectors. Each one can verify a connection, pull contacts plus closed
// deals / paid jobs (so we know who became a customer and for how much), and push new
// leads Elevated captures into the CRM.
// API docs: developers.hubspot.com, developers.pipedrive.com, zoho.com/crm/developer,
// developer.getjobber.com, docs.housecallpro.com.

export type CrmConn = { provider: CrmProvider; token: string; extra: Record<string, any> };
export type PulledLead = LeadDraft & { externalId: string };
export type PushLead = { name: string; email: string | null; phone: string | null; company: string | null; source: string; notes: string | null };

export type CrmConnector = {
  name: string;
  /** How clients connect: paste a key, sign in (OAuth), or either. */
  methods: ("token" | "oauth")[];
  tokenLabel?: string;
  tokenSteps?: string[];
  verify(c: CrmConn): Promise<{ accountName: string }>;
  pull(c: CrmConn): Promise<PulledLead[]>;
  push?(c: CrmConn, lead: PushLead): Promise<string | null>;
};

const MAX = 3000; // records per object type per sync

const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return { first: parts.length > 1 ? parts.slice(0, -1).join(" ") : "", last: parts.length > 1 ? parts[parts.length - 1] : parts[0] };
};
const joinName = (...p: (string | null | undefined)[]) => p.filter((x) => x && String(x).trim()).join(" ").trim();

function draft(externalId: string, name: string, f: Partial<LeadDraft> = {}): PulledLead {
  return {
    externalId,
    name: (name || f.email || f.phone || "Unnamed contact").slice(0, 200),
    email: f.email?.toLowerCase() ?? null,
    phone: f.phone ?? null,
    company: f.company ?? null,
    source: f.source ?? "other",
    status: f.status ?? "NEW",
    valueCents: f.valueCents ?? 0,
    occurredAt: f.occurredAt ?? null,
  };
}

/** Applies deals/jobs to the contacts they belong to: won adds value and marks the contact a customer. */
function applyDeals(byId: Map<string, PulledLead>, deals: { contactId: string | null; status: "WON" | "LOST" | "OPEN"; cents: number; at: Date | null; title: string; id: string }[]) {
  for (const d of deals) {
    let lead = d.contactId ? byId.get(d.contactId) : undefined;
    if (!lead) {
      if (d.status !== "WON") continue;
      lead = draft(`deal:${d.id}`, d.title, { status: "WON" });
      byId.set(lead.externalId, lead);
    }
    if (d.status === "WON") {
      lead.status = "WON";
      lead.valueCents += d.cents;
      if (d.at && (!lead.occurredAt || d.at > lead.occurredAt)) lead.occurredAt = lead.occurredAt ?? d.at;
    } else if (d.status === "OPEN" && lead.status === "NEW") lead.status = "CONTACTED";
    else if (d.status === "LOST" && lead.status === "NEW") lead.status = "LOST";
  }
}

// ---------------------------------------------------------------------------
// HubSpot

const HUBSPOT_SOURCE: Record<string, Channel> = {
  ORGANIC_SEARCH: "google",
  PAID_SEARCH: "google_ads",
  SOCIAL_MEDIA: "facebook",
  PAID_SOCIAL: "facebook",
  EMAIL_MARKETING: "email",
  REFERRALS: "referral",
  DIRECT_TRAFFIC: "website",
  AI_REFERRALS: "ai_search",
};

const hs = (c: CrmConn, path: string, init: RequestInit = {}) =>
  fetchJson<any>(`https://api.hubapi.com${path}`, { ...init, headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });

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
  async pull(c) {
    const byId = new Map<string, PulledLead>();
    let after: string | undefined;
    do {
      const res = await hs(c, `/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,company,hs_analytics_source,lifecyclestage,createdate${after ? `&after=${after}` : ""}`);
      for (const r of res.results ?? []) {
        const p = r.properties ?? {};
        const stage = String(p.lifecyclestage ?? "");
        byId.set(r.id, draft(r.id, joinName(p.firstname, p.lastname), {
          email: p.email, phone: p.phone, company: p.company,
          source: HUBSPOT_SOURCE[p.hs_analytics_source] ?? normalizeSource(p.hs_analytics_source),
          status: stage === "customer" ? "WON" : /opportunity|salesqualified|marketingqualified/.test(stage) ? "CONTACTED" : "NEW",
          occurredAt: parseDate(p.createdate),
        }));
      }
      after = res.paging?.next?.after;
    } while (after && byId.size < MAX);

    const deals: Parameters<typeof applyDeals>[1] = [];
    after = undefined;
    do {
      const res = await hs(c, `/crm/v3/objects/deals?limit=100&properties=dealname,amount,hs_is_closed_won,hs_is_closed,closedate&associations=contacts${after ? `&after=${after}` : ""}`);
      for (const d of res.results ?? []) {
        const p = d.properties ?? {};
        const won = p.hs_is_closed_won === "true";
        deals.push({
          id: d.id,
          title: p.dealname ?? "HubSpot deal",
          contactId: d.associations?.contacts?.results?.[0]?.id ?? null,
          status: won ? "WON" : p.hs_is_closed === "true" ? "LOST" : "OPEN",
          cents: Math.round(Number(p.amount || 0) * 100),
          at: parseDate(p.closedate),
        });
      }
      after = res.paging?.next?.after;
    } while (after && deals.length < MAX);
    applyDeals(byId, deals);
    return [...byId.values()];
  },
  async push(c, lead) {
    const { first, last } = splitName(lead.name);
    try {
      const res = await hs(c, "/crm/v3/objects/contacts", {
        method: "POST",
        body: JSON.stringify({ properties: { firstname: first, lastname: last, email: lead.email ?? undefined, phone: lead.phone ?? undefined, company: lead.company ?? undefined } }),
      });
      return res.id ?? null;
    } catch (err: any) {
      if (err?.status === 409) return null; // already in HubSpot
      throw err;
    }
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

const firstValue = (v: any) => (Array.isArray(v) ? (v.find((x) => x?.primary) ?? v[0])?.value : v) || null;

const pipedrive: CrmConnector = {
  name: "Pipedrive",
  methods: ["token", "oauth"],
  tokenLabel: "Personal API token",
  tokenSteps: [
    "In Pipedrive, click your profile picture → Personal preferences → API.",
    "Copy your personal API token and paste it here.",
  ],
  async verify(c) {
    const me = await pd(c, "/users/me");
    return { accountName: me.data?.company_name ? `${me.data.company_name} (Pipedrive)` : "Pipedrive" };
  },
  async pull(c) {
    const byId = new Map<string, PulledLead>();
    let start = 0;
    for (;;) {
      const res = await pd(c, `/persons?start=${start}&limit=100`);
      for (const p of res.data ?? []) {
        byId.set(String(p.id), draft(String(p.id), p.name, {
          email: firstValue(p.email), phone: firstValue(p.phone), company: p.org_name ?? null, occurredAt: parseDate(p.add_time),
        }));
      }
      const more = res.additional_data?.pagination?.more_items_in_collection;
      if (!more || byId.size >= MAX) break;
      start = res.additional_data.pagination.next_start;
    }
    const deals: Parameters<typeof applyDeals>[1] = [];
    start = 0;
    for (;;) {
      const res = await pd(c, `/deals?status=all_not_deleted&start=${start}&limit=100`);
      for (const d of res.data ?? []) {
        const personId = typeof d.person_id === "object" && d.person_id ? d.person_id.value : d.person_id;
        deals.push({
          id: String(d.id),
          title: d.title ?? "Pipedrive deal",
          contactId: personId ? String(personId) : null,
          status: d.status === "won" ? "WON" : d.status === "lost" ? "LOST" : "OPEN",
          cents: Math.round(Number(d.value || 0) * 100),
          at: parseDate(d.won_time ?? d.close_time),
        });
      }
      const more = res.additional_data?.pagination?.more_items_in_collection;
      if (!more || deals.length >= MAX) break;
      start = res.additional_data.pagination.next_start;
    }
    applyDeals(byId, deals);
    return [...byId.values()];
  },
  async push(c, lead) {
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
};

// ---------------------------------------------------------------------------
// Zoho CRM (sign-in only)

const ZOHO_VERSION = process.env.ZOHO_CRM_API_VERSION || "v7";
const zo = (c: CrmConn, path: string, init: RequestInit = {}) =>
  fetchJson<any>(`${c.extra.apiDomain || "https://www.zohoapis.com"}/crm/${ZOHO_VERSION}${path}`, {
    ...init,
    headers: { Authorization: `Zoho-oauthtoken ${c.token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

async function zohoAll(c: CrmConn, module: string, fields: string) {
  const out: any[] = [];
  for (let page = 1; out.length < MAX; page++) {
    const res = await zo(c, `/${module}?fields=${fields}&per_page=200&page=${page}`);
    out.push(...(res?.data ?? []));
    if (!res?.info?.more_records) break;
  }
  return out;
}

const zoho: CrmConnector = {
  name: "Zoho CRM",
  methods: ["oauth"],
  async verify(c) {
    const org = await zo(c, "/org").catch(() => null);
    return { accountName: org?.org?.[0]?.company_name ? `${org.org[0].company_name} (Zoho CRM)` : "Zoho CRM" };
  },
  async pull(c) {
    const byId = new Map<string, PulledLead>();
    const leads = await zohoAll(c, "Leads", "First_Name,Last_Name,Email,Phone,Company,Lead_Source,Lead_Status,Created_Time");
    for (const l of leads) {
      byId.set(`lead:${l.id}`, draft(`lead:${l.id}`, joinName(l.First_Name, l.Last_Name), {
        email: l.Email, phone: l.Phone, company: l.Company, source: normalizeSource(l.Lead_Source), status: parseStatus(l.Lead_Status), occurredAt: parseDate(l.Created_Time),
      }));
    }
    const contacts = await zohoAll(c, "Contacts", "First_Name,Last_Name,Email,Phone,Account_Name,Lead_Source,Created_Time");
    for (const x of contacts) {
      byId.set(`contact:${x.id}`, draft(`contact:${x.id}`, joinName(x.First_Name, x.Last_Name), {
        email: x.Email, phone: x.Phone, company: x.Account_Name?.name ?? null, source: normalizeSource(x.Lead_Source), status: "CONTACTED", occurredAt: parseDate(x.Created_Time),
      }));
    }
    const deals = await zohoAll(c, "Deals", "Deal_Name,Amount,Stage,Closing_Date,Contact_Name");
    applyDeals(byId, deals.map((d) => ({
      id: String(d.id),
      title: d.Deal_Name ?? "Zoho deal",
      contactId: d.Contact_Name?.id ? `contact:${d.Contact_Name.id}` : null,
      status: /closed.?won/i.test(d.Stage ?? "") ? "WON" : /closed.?lost/i.test(d.Stage ?? "") ? "LOST" : "OPEN",
      cents: Math.round(Number(d.Amount || 0) * 100),
      at: parseDate(d.Closing_Date),
    })));
    return [...byId.values()];
  },
  async push(c, lead) {
    const { first, last } = splitName(lead.name);
    const res = await zo(c, "/Leads", {
      method: "POST",
      body: JSON.stringify({
        data: [{ First_Name: first || undefined, Last_Name: last, Email: lead.email ?? undefined, Phone: lead.phone ?? undefined, Company: lead.company ?? undefined, Description: `Lead from Elevated (source: ${lead.source})${lead.notes ? `\n${lead.notes}` : ""}` }],
      }),
    });
    return res?.data?.[0]?.details?.id ? `lead:${res.data[0].details.id}` : null;
  },
};

// ---------------------------------------------------------------------------
// Jobber (sign-in only; GraphQL). Pull only for now: clients + paid invoices.

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
  async pull(c) {
    const byId = new Map<string, PulledLead>();
    let after: string | null = null;
    do {
      const d: any = await jb(c, `query($after: String) { clients(first: 50, after: $after) { nodes { id firstName lastName companyName createdAt emails { address primary } phones { number primary } } pageInfo { hasNextPage endCursor } } }`, { after });
      for (const n of d.clients.nodes) {
        byId.set(n.id, draft(n.id, joinName(n.firstName, n.lastName) || n.companyName, {
          email: (n.emails?.find((e: any) => e.primary) ?? n.emails?.[0])?.address ?? null,
          phone: (n.phones?.find((p: any) => p.primary) ?? n.phones?.[0])?.number ?? null,
          company: n.companyName ?? null,
          occurredAt: parseDate(n.createdAt),
        }));
      }
      after = d.clients.pageInfo.hasNextPage ? d.clients.pageInfo.endCursor : null;
    } while (after && byId.size < MAX);

    const deals: Parameters<typeof applyDeals>[1] = [];
    after = null;
    do {
      const d: any = await jb(c, `query($after: String) { invoices(first: 50, after: $after) { nodes { id invoiceNumber invoiceStatus issuedDate amounts { total } client { id } } pageInfo { hasNextPage endCursor } } }`, { after });
      for (const n of d.invoices.nodes) {
        const status = String(n.invoiceStatus ?? "").toLowerCase();
        deals.push({
          id: n.id,
          title: `Invoice ${n.invoiceNumber ?? ""}`.trim(),
          contactId: n.client?.id ?? null,
          status: status === "paid" ? "WON" : /bad_debt|void/.test(status) ? "LOST" : "OPEN",
          cents: Math.round(Number(n.amounts?.total ?? 0) * 100),
          at: parseDate(n.issuedDate),
        });
      }
      after = d.invoices.pageInfo.hasNextPage ? d.invoices.pageInfo.endCursor : null;
    } while (after && deals.length < MAX);
    applyDeals(byId, deals);
    return [...byId.values()];
  },
};

// ---------------------------------------------------------------------------
// Housecall Pro (API key; requires their MAX plan)

const hcp = (c: CrmConn, path: string, init: RequestInit = {}) =>
  fetchJson<any>(`https://api.housecallpro.com${path}`, {
    ...init,
    headers: { Authorization: `Token ${c.token}`, Accept: "application/json", "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

const housecallPro: CrmConnector = {
  name: "Housecall Pro",
  methods: ["token"],
  tokenLabel: "API key",
  tokenSteps: [
    "In Housecall Pro, go to My Apps → App Store → API (requires the MAX plan).",
    "Generate an API key and paste it here.",
  ],
  async verify(c) {
    const co = await hcp(c, "/company").catch(() => null);
    await hcp(c, "/customers?page=1&page_size=1");
    return { accountName: co?.name ? `${co.name} (Housecall Pro)` : "Housecall Pro" };
  },
  async pull(c) {
    const byId = new Map<string, PulledLead>();
    for (let page = 1; byId.size < MAX; page++) {
      const res = await hcp(c, `/customers?page=${page}&page_size=100`);
      for (const x of res.customers ?? []) {
        byId.set(x.id, draft(x.id, joinName(x.first_name, x.last_name) || x.company, {
          email: x.email ?? null, phone: x.mobile_number ?? x.home_number ?? x.work_number ?? null, company: x.company ?? null,
          source: normalizeSource(x.lead_source), occurredAt: parseDate(x.created_at),
        }));
      }
      if (!res.total_pages || page >= res.total_pages) break;
    }
    const deals: Parameters<typeof applyDeals>[1] = [];
    for (let page = 1; deals.length < MAX; page++) {
      const res = await hcp(c, `/jobs?page=${page}&page_size=100`);
      for (const j of res.jobs ?? []) {
        const status = String(j.work_status ?? "").toLowerCase();
        deals.push({
          id: j.id,
          title: j.description ?? "Housecall Pro job",
          contactId: j.customer?.id ?? null,
          status: /complete/.test(status) ? "WON" : /cancel/.test(status) ? "LOST" : "OPEN",
          cents: Math.round(Number(j.total_amount ?? 0)), // Housecall Pro amounts are in cents
          at: parseDate(j.work_timestamps?.completed_at ?? j.created_at),
        });
      }
      if (!res.total_pages || page >= res.total_pages) break;
    }
    applyDeals(byId, deals);
    return [...byId.values()];
  },
  async push(c, lead) {
    const { first, last } = splitName(lead.name);
    const res = await hcp(c, "/customers", {
      method: "POST",
      body: JSON.stringify({ first_name: first || last, last_name: first ? last : "", email: lead.email ?? undefined, mobile_number: lead.phone ?? undefined, company: lead.company ?? undefined, lead_source: "Elevated", notifications_enabled: false }),
    });
    return res?.id ?? null;
  },
};

export const CONNECTORS: Record<CrmProvider, CrmConnector> = {
  HUBSPOT: hubspot,
  PIPEDRIVE: pipedrive,
  ZOHO: zoho,
  JOBBER: jobber,
  HOUSECALL_PRO: housecallPro,
};
