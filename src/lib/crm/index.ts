import "server-only";
import type { CrmConnection, CrmProvider, Lead, Prisma } from "@prisma/client";
import { db } from "../db";
import { decrypt, encrypt } from "../crypto";
import { appUrl } from "../stripe";
import { form, fetchJson } from "../publishers/http";
import { upsertCrmLeads } from "../leads";
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

/** Pulls contacts and won deals/jobs from one CRM into the lead list. */
export async function syncCrm(conn: CrmConnection) {
  try {
    const c = await live(conn);
    const items = await CONNECTORS[conn.provider].pull(c);
    const created = await upsertCrmLeads(conn.businessId, conn.provider, items);
    await db.crmConnection.update({ where: { id: conn.id }, data: { lastSyncAt: new Date(), lastSyncCount: items.length, lastError: null, status: "active" } });
    if (created) await logActivity(conn.businessId, "crm", `Synced ${CONNECTORS[conn.provider].name}: ${created} new contact${created === 1 ? "" : "s"}, ${items.length} total`);
    return { total: items.length, created };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await db.crmConnection.update({ where: { id: conn.id }, data: { lastError: message.slice(0, 500), status: "error" } });
    throw new Error(`${CONNECTORS[conn.provider].name}: ${message}`);
  }
}

/** Daily: sync every connected CRM. */
export async function syncAllCrms() {
  const conns = await db.crmConnection.findMany();
  const results: { id: string; ok: boolean; detail: string }[] = [];
  for (const c of conns) {
    try {
      const r = await syncCrm(c);
      results.push({ id: c.id, ok: true, detail: `${r.total} records, ${r.created} new` });
    } catch (err) {
      results.push({ id: c.id, ok: false, detail: err instanceof Error ? err.message : "error" });
    }
  }
  return results;
}

/** Sends a newly captured lead to every connected CRM that accepts new leads. Best effort. */
export async function pushLeadToCrms(businessId: string, lead: Lead) {
  const conns = await db.crmConnection.findMany({ where: { businessId, pushNewLeads: true, status: "active" } });
  for (const conn of conns) {
    const connector = CONNECTORS[conn.provider];
    if (!connector.push) continue;
    try {
      const externalId = await connector.push(await live(conn), {
        name: lead.name, email: lead.email, phone: lead.phone, company: lead.company, source: lead.source, notes: lead.notes,
      });
      if (externalId && !lead.crm) {
        await db.lead.update({ where: { id: lead.id }, data: { crm: conn.provider, externalId } }).catch(() => {});
      }
    } catch (err) {
      console.error(`Push to ${conn.provider} failed`, err);
      await db.crmConnection.update({ where: { id: conn.id }, data: { lastError: `Couldn't add a new lead: ${err instanceof Error ? err.message : "error"}`.slice(0, 500) } });
    }
  }
}
