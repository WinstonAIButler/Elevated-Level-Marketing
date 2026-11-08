import "server-only";
import type { CrmConnection, CrmProvider, Lead, Prisma } from "@prisma/client";
import { db } from "../db";
import { decrypt, encrypt } from "../crypto";
import { appUrl } from "../stripe";
import { form, fetchJson } from "../publishers/http";
import { logActivity } from "../usage";
import { CONNECTORS, type CrmConn } from "./providers";

export { CONNECTORS } from "./providers";

export const CRM_PROVIDERS = Object.keys(CONNECTORS) as CrmProvider[];
export const isCrmProvider = (v: string): v is CrmProvider => v in CONNECTORS;
export const CRM_OAUTH_COOKIE = "edm_crm_oauth";

// ---------------------------------------------------------------------------
// One-click sign-in (OAuth). Each needs a developer app; redirect URI to register:
//   <APP_URL>/api/crm/connect/<provider>/callback   (lowercase, e.g. /api/crm/connect/zoho/callback)

type OAuthCfg = { authorize: string; token: (extra: Record<string, any>) => string; idEnv: string; secretEnv: string; scope?: string; params?: Record<string, string>; basicAuth?: boolean };

const OAUTH: Partial<Record<CrmProvider, OAuthCfg>> = {
  HUBSPOT: {
    authorize: "https://app.hubspot.com/oauth/authorize",
    token: () => "https://api.hubapi.com/oauth/v1/token",
    idEnv: "HUBSPOT_CLIENT_ID",
    secretEnv: "HUBSPOT_CLIENT_SECRET",
    scope: "crm.objects.contacts.read crm.objects.contacts.write crm.objects.deals.read",
  },
  PIPEDRIVE: {
    authorize: "https://oauth.pipedrive.com/oauth/authorize",
    token: () => "https://oauth.pipedrive.com/oauth/token",
    idEnv: "PIPEDRIVE_CLIENT_ID",
    secretEnv: "PIPEDRIVE_CLIENT_SECRET",
    basicAuth: true,
  },
  ZOHO: {
    authorize: "https://accounts.zoho.com/oauth/v2/auth",
    token: (extra) => `${extra.accountsServer || "https://accounts.zoho.com"}/oauth/v2/token`,
    idEnv: "ZOHO_CLIENT_ID",
    secretEnv: "ZOHO_CLIENT_SECRET",
    scope: "ZohoCRM.modules.ALL,ZohoCRM.org.READ",
    params: { access_type: "offline", prompt: "consent" },
  },
  JOBBER: {
    authorize: "https://api.getjobber.com/api/oauth/authorize",
    token: () => "https://api.getjobber.com/api/oauth/token",
    idEnv: "JOBBER_CLIENT_ID",
    secretEnv: "JOBBER_CLIENT_SECRET",
  },
};

export function oauthAvailable(p: CrmProvider) {
  const cfg = OAUTH[p];
  return Boolean(cfg && process.env[cfg.idEnv] && process.env[cfg.secretEnv]);
}

export const crmRedirectUri = (p: CrmProvider) => `${appUrl()}/api/crm/connect/${p.toLowerCase()}/callback`;

export function crmAuthorizeUrl(p: CrmProvider, state: string) {
  const cfg = OAUTH[p]!;
  const q = new URLSearchParams({ client_id: process.env[cfg.idEnv]!, redirect_uri: crmRedirectUri(p), response_type: "code", state, ...(cfg.params ?? {}) });
  if (cfg.scope) q.set("scope", cfg.scope);
  return `${cfg.authorize}?${q}`;
}

async function tokenRequest(p: CrmProvider, extra: Record<string, any>, params: Record<string, string>) {
  const cfg = OAUTH[p]!;
  const id = process.env[cfg.idEnv]!;
  const secret = process.env[cfg.secretEnv]!;
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  const body: Record<string, string> = { ...params };
  if (cfg.basicAuth) headers.Authorization = `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
  else Object.assign(body, { client_id: id, client_secret: secret });
  return fetchJson<any>(cfg.token(extra), { method: "POST", headers, body: form(body) });
}

export async function exchangeCrmCode(p: CrmProvider, code: string, extra: Record<string, any>) {
  const t = await tokenRequest(p, extra, { grant_type: "authorization_code", code, redirect_uri: crmRedirectUri(p) });
  return {
    accessToken: t.access_token as string,
    refreshToken: (t.refresh_token as string | undefined) ?? null,
    expiresAt: t.expires_in ? new Date(Date.now() + Number(t.expires_in) * 1000) : null,
    extra: { ...extra, ...(t.api_domain ? { apiDomain: t.api_domain } : {}) },
  };
}

/** Decrypts a connection, refreshing an OAuth token that's about to expire. */
async function live(conn: CrmConnection): Promise<CrmConn> {
  let c = conn;
  const extra = (c.extra as Record<string, any>) ?? {};
  if (c.method === "oauth" && c.refreshTokenEnc && c.expiresAt && c.expiresAt.getTime() < Date.now() + 5 * 60_000) {
    const t = await tokenRequest(c.provider, extra, { grant_type: "refresh_token", refresh_token: decrypt(c.refreshTokenEnc) });
    c = await db.crmConnection.update({
      where: { id: c.id },
      data: {
        accessTokenEnc: encrypt(t.access_token),
        refreshTokenEnc: t.refresh_token ? encrypt(t.refresh_token) : c.refreshTokenEnc,
        expiresAt: t.expires_in ? new Date(Date.now() + Number(t.expires_in) * 1000) : null,
        extra: { ...extra, ...(t.api_domain ? { apiDomain: t.api_domain } : {}) } as Prisma.InputJsonValue,
      },
    });
  }
  return { provider: c.provider, token: decrypt(c.accessTokenEnc), extra: { ...((c.extra as Record<string, any>) ?? {}), method: c.method } };
}

/** Saves a connection after checking it works. */
export async function saveCrmConnection(
  businessId: string,
  provider: CrmProvider,
  data: { method: "oauth" | "token"; accessToken: string; refreshToken?: string | null; expiresAt?: Date | null; extra?: Record<string, any> },
) {
  const conn: CrmConn = { provider, token: data.accessToken, extra: { ...(data.extra ?? {}), method: data.method } };
  const { accountName } = await CONNECTORS[provider].verify(conn);
  const row = {
    method: data.method,
    accessTokenEnc: encrypt(data.accessToken),
    refreshTokenEnc: data.refreshToken ? encrypt(data.refreshToken) : null,
    expiresAt: data.expiresAt ?? null,
    extra: (data.extra ?? {}) as Prisma.InputJsonValue,
    accountName,
    status: "active",
    lastError: null,
  };
  const saved = await db.crmConnection.upsert({
    where: { businessId_provider: { businessId, provider } },
    create: { businessId, provider, ...row },
    update: row,
  });
  await logActivity(businessId, "crm", `Connected ${CONNECTORS[provider].name} (${accountName})`);
  return saved;
}

/** Sends one lead to the business's CRM (or finds the person if they're already there) and starts following it. */
export async function sendLeadToCrm(lead: Lead, connection?: CrmConnection) {
  const conn =
    connection ??
    (await db.crmConnection.findFirst({ where: { businessId: lead.businessId, status: "active" }, orderBy: { createdAt: "asc" } }));
  if (!conn) throw new Error("Connect a CRM first.");
  const connector = CONNECTORS[conn.provider];
  const c = await live(conn);
  let externalId: string | null = null;
  if (connector.push) {
    externalId = await connector.push(c, { name: lead.name, email: lead.email, phone: lead.phone, company: lead.company, source: lead.source, notes: lead.notes });
  } else if (connector.find && lead.email) {
    externalId = await connector.find(c, lead.email);
    if (!externalId) {
      return { sent: false, reason: `${connector.name} can't receive new leads from Elevated. Add ${lead.name} in ${connector.name} with the same email and we'll start following them on the next check.` };
    }
  }
  if (!externalId) throw new Error(`${connector.name} didn't return the new record.`);
  await db.lead.update({ where: { id: lead.id }, data: { crm: conn.provider, externalId, pushedAt: new Date() } });
  await logActivity(lead.businessId, "crm", `Sent ${lead.name} to ${connector.name}`);
  return { sent: true as const };
}

/** New lead captured by Elevated: send it right away if the client turned that on. */
export async function autoSendLead(lead: Lead) {
  const conn = await db.crmConnection.findFirst({ where: { businessId: lead.businessId, status: "active", pushNewLeads: true }, orderBy: { createdAt: "asc" } });
  if (!conn) return;
  try {
    await sendLeadToCrm(lead, conn);
  } catch (err) {
    console.error(`Sending lead to ${conn.provider} failed`, err);
    await db.crmConnection.update({ where: { id: conn.id }, data: { lastError: `Couldn't send ${lead.name}: ${err instanceof Error ? err.message : "error"}`.slice(0, 500) } });
  }
}

/** Checks where one sent lead stands in the CRM and records any change. */
export async function trackLead(lead: Lead, conn: CrmConnection) {
  if (!lead.externalId) return null;
  const t = await CONNECTORS[conn.provider].track(await live(conn), lead.externalId);
  const becameCustomer = t.status === "WON" && lead.status !== "WON";
  await db.lead.update({
    where: { id: lead.id },
    data: {
      status: t.status,
      // Keep a value someone typed in if the CRM has none.
      valueCents: t.valueCents || (t.status === "WON" ? lead.valueCents : 0),
      wonAt: t.status === "WON" ? lead.wonAt ?? t.wonAt ?? new Date() : null,
      crmStage: t.stage?.slice(0, 120) ?? null,
      trackedAt: new Date(),
    },
  });
  if (becameCustomer) {
    const value = t.valueCents || lead.valueCents;
    await logActivity(lead.businessId, "leads", `${lead.name} became a customer${value ? ` ($${(value / 100).toLocaleString()})` : ""}, tracked in ${CONNECTORS[conn.provider].name}`);
  }
  return t;
}

/** Follows every lead Elevated sent to a CRM in the last year. Leads waiting on an import-only CRM are matched by email. */
export async function trackAllLeads(businessId?: string) {
  const conns = await db.crmConnection.findMany({ where: { status: { in: ["active", "error"] }, ...(businessId ? { businessId } : {}) } });
  let checked = 0;
  const errors: string[] = [];
  for (const conn of conns) {
    const connector = CONNECTORS[conn.provider];
    let ok = true;
    // Import-only CRMs (Jobber): look for unsent leads by email.
    if (!connector.push && connector.find) {
      const waiting = await db.lead.findMany({ where: { businessId: conn.businessId, crm: null, email: { not: null }, occurredAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }, take: 200 });
      for (const l of waiting) await sendLeadToCrm(l, conn).catch(() => {});
    }
    const leads = await db.lead.findMany({
      where: { businessId: conn.businessId, crm: conn.provider, externalId: { not: null }, pushedAt: { gte: new Date(Date.now() - 365 * 86_400_000) } },
      orderBy: { trackedAt: { sort: "asc", nulls: "first" } },
      take: 500,
    });
    for (const l of leads) {
      try {
        await trackLead(l, conn);
        checked++;
      } catch (err) {
        ok = false;
        errors.push(`${conn.provider} ${l.id}: ${err instanceof Error ? err.message : "error"}`);
      }
    }
    await db.crmConnection.update({
      where: { id: conn.id },
      data: { lastSyncAt: new Date(), lastSyncCount: leads.length, ...(ok ? { status: "active", lastError: null } : { lastError: errors[errors.length - 1]?.slice(0, 500) }) },
    });
  }
  return { connections: conns.length, checked, errors };
}
