import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Provider } from "@prisma/client";
import { appUrl } from "./stripe";
import { fetchJson, form } from "./publishers/http";

// OAuth 2 for each platform. Each platform needs its own developer app; the redirect
// URI to register with every app is  <APP_URL>/api/connect/<provider>/callback
// (lowercase provider, e.g. /api/connect/meta/callback).

export const OAUTH_COOKIE = "edm_oauth";

export const META_VERSION = process.env.META_GRAPH_VERSION || "v23.0";

type OAuthConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  scopes: string[];
  scopeSeparator: string;
  extraParams?: Record<string, string>;
  pkce?: boolean;
  /** TikTok calls the client id "client_key". */
  clientIdParam?: string;
  /** X wants the client credentials as HTTP Basic auth on the token call. */
  basicAuth?: boolean;
  /** Meta's token endpoint is a GET with query parameters. */
  tokenViaGet?: boolean;
};

const GOOGLE = {
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  clientIdEnv: "GOOGLE_CLIENT_ID",
  clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  scopeSeparator: " ",
  extraParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
};

export const OAUTH: Record<Provider, OAuthConfig> = {
  META: {
    authorizeUrl: `https://www.facebook.com/${META_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${META_VERSION}/oauth/access_token`,
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
    scopes: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "instagram_basic",
      "instagram_content_publish",
      "business_management",
      "ads_management",
      "ads_read",
    ],
    scopeSeparator: ",",
    tokenViaGet: true,
  },
  GOOGLE_ADS: { ...GOOGLE, scopes: ["https://www.googleapis.com/auth/adwords"] },
  GOOGLE_BUSINESS: { ...GOOGLE, scopes: ["https://www.googleapis.com/auth/business.manage"] },
  LINKEDIN: {
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    scopes: (process.env.LINKEDIN_SCOPES || "openid profile w_member_social").split(/[ ,]+/),
    scopeSeparator: " ",
  },
  TIKTOK: {
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    clientIdEnv: "TIKTOK_CLIENT_KEY",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
    clientIdParam: "client_key",
    scopes: ["user.info.basic", "video.upload"],
    scopeSeparator: ",",
  },
  X: {
    authorizeUrl: "https://x.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    clientIdEnv: "X_CLIENT_ID",
    clientSecretEnv: "X_CLIENT_SECRET",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    scopeSeparator: " ",
    pkce: true,
    basicAuth: true,
  },
};

export function redirectUri(p: Provider) {
  return `${appUrl()}/api/connect/${p.toLowerCase()}/callback`;
}

export function pkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authorizeUrl(p: Provider, state: string, codeChallenge?: string) {
  const c = OAUTH[p];
  const params = new URLSearchParams({
    [c.clientIdParam ?? "client_id"]: process.env[c.clientIdEnv] ?? "",
    redirect_uri: redirectUri(p),
    response_type: "code",
    scope: c.scopes.join(c.scopeSeparator),
    state,
    ...(c.extraParams ?? {}),
  });
  if (c.pkce && codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }
  return `${c.authorizeUrl}?${params}`;
}

export type TokenSet = { accessToken: string; refreshToken?: string; expiresAt?: Date; scope?: string };

function toTokenSet(t: Record<string, any>): TokenSet {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: t.expires_in ? new Date(Date.now() + Number(t.expires_in) * 1000) : undefined,
    scope: t.scope,
  };
}

async function tokenCall(p: Provider, params: Record<string, string | undefined>) {
  const c = OAUTH[p];
  const id = process.env[c.clientIdEnv] ?? "";
  const secret = process.env[c.clientSecretEnv] ?? "";
  if (c.tokenViaGet) {
    const q = form({ client_id: id, client_secret: secret, ...params });
    return fetchJson<Record<string, any>>(`${c.tokenUrl}?${q}`);
  }
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  const body: Record<string, string | undefined> = { ...params };
  if (c.basicAuth) headers.Authorization = `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
  else Object.assign(body, { [c.clientIdParam ?? "client_id"]: id, client_secret: secret });
  if (c.basicAuth) body.client_id = id;
  return fetchJson<Record<string, any>>(c.tokenUrl, { method: "POST", headers, body: form(body) });
}

export async function exchangeCode(p: Provider, code: string, codeVerifier?: string): Promise<TokenSet> {
  const t = await tokenCall(p, {
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(p),
    code_verifier: codeVerifier,
  });
  if (p === "META") {
    // Swap the short-lived user token for a long-lived (~60 day) one.
    const long = await tokenCall(p, { grant_type: "fb_exchange_token", fb_exchange_token: t.access_token });
    return toTokenSet(long);
  }
  return toTokenSet(t);
}

export async function refreshTokens(p: Provider, refreshToken: string): Promise<TokenSet> {
  const t = await tokenCall(p, { grant_type: "refresh_token", refresh_token: refreshToken });
  const set = toTokenSet(t);
  set.refreshToken ??= refreshToken; // Google doesn't resend it
  return set;
}

/** Elevated's own Google Ads manager-account token, for wallet-funded (managed) ads. */
export async function managedGoogleAdsToken() {
  const set = await refreshTokens("GOOGLE_ADS", process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "");
  return set.accessToken;
}
