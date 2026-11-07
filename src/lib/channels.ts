import type { Provider } from "@prisma/client";

// Catalog of the platforms Elevated publishes to. Pure data, safe on client and server.

export type ChannelInfo = {
  id: Provider;
  name: string;
  /** What we do there once it's connected. */
  does: string;
  /** Organic posts we can publish automatically. */
  autoPosts: boolean;
  /** Paid campaigns we can launch automatically (otherwise they go to the Elevated team). */
  autoAds: boolean;
  /** Takes part of the ad budget at all. */
  paid: boolean;
  /** Why something is handed to the team instead of automated. */
  manualNote?: string;
  /** Matches platform names the AI writes in plans and campaigns. */
  match: RegExp;
  /** Env vars for this platform's developer app. */
  appEnv: string[];
};

export const CHANNELS: Record<Provider, ChannelInfo> = {
  META: {
    id: "META",
    name: "Facebook & Instagram",
    does: "Posts to your Facebook Page and Instagram, and runs Meta ads",
    autoPosts: true,
    autoAds: true,
    paid: true,
    match: /facebook|instagram|meta|\bfb\b|\big\b/i,
    appEnv: ["META_APP_ID", "META_APP_SECRET"],
  },
  GOOGLE_ADS: {
    id: "GOOGLE_ADS",
    name: "Google Ads",
    does: "Runs Google Search ads for the searches your customers make",
    autoPosts: false,
    autoAds: true,
    paid: true,
    match: /google ads|google search|adwords|search ads|\bppc\b|\bsem\b/i,
    appEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN"],
  },
  GOOGLE_BUSINESS: {
    id: "GOOGLE_BUSINESS",
    name: "Google Business Profile",
    does: "Posts updates and offers to your Google Maps / Search listing (free)",
    autoPosts: true,
    autoAds: false,
    paid: false,
    match: /google business|business profile|\bgbp\b|google maps|google my business/i,
    appEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
  LINKEDIN: {
    id: "LINKEDIN",
    name: "LinkedIn",
    does: "Posts to your LinkedIn company page or profile",
    autoPosts: true,
    autoAds: false,
    paid: true,
    manualNote: "LinkedIn ads are set up by the Elevated team",
    match: /linkedin/i,
    appEnv: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  },
  TIKTOK: {
    id: "TIKTOK",
    name: "TikTok",
    does: "TikTok videos and ads, produced with the Elevated team",
    autoPosts: false,
    autoAds: false,
    paid: true,
    manualNote: "TikTok needs video, so the Elevated team produces and launches it",
    match: /tiktok/i,
    appEnv: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
  },
  X: {
    id: "X",
    name: "X (Twitter)",
    does: "Posts to your X account",
    autoPosts: true,
    autoAds: false,
    paid: true,
    manualNote: "X ads are set up by the Elevated team",
    match: /\bx\b|twitter/i,
    appEnv: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
  },
};

export const PROVIDERS = Object.keys(CHANNELS) as Provider[];
export const PAID_PROVIDERS = PROVIDERS.filter((p) => CHANNELS[p].paid);

export function providerForPlatform(platform: string): Provider | null {
  // Check Google Business before Google Ads so "Google Business Profile" isn't read as ads.
  for (const p of ["GOOGLE_BUSINESS", "GOOGLE_ADS", "META", "LINKEDIN", "TIKTOK", "X"] as Provider[]) {
    if (CHANNELS[p].match.test(platform)) return p;
  }
  return null;
}

export function isProvider(value: string): value is Provider {
  return value in CHANNELS;
}

/** Whether the developer app for this platform is configured on the server. */
export function appConfigured(p: Provider, env: Record<string, string | undefined> = process.env) {
  return CHANNELS[p].appEnv.every((k) => Boolean(env[k]));
}

/** Whether Elevated's own (managed) ad account is set up for wallet-funded ads on this platform. */
export function managedAdsConfigured(p: Provider, env: Record<string, string | undefined> = process.env) {
  if (p === "META") return Boolean(env.META_SYSTEM_USER_TOKEN && env.META_AD_ACCOUNT_ID);
  if (p === "GOOGLE_ADS") return Boolean(env.GOOGLE_ADS_DEVELOPER_TOKEN && env.GOOGLE_ADS_LOGIN_CUSTOMER_ID && env.GOOGLE_ADS_MANAGED_CUSTOMER_ID && env.GOOGLE_ADS_REFRESH_TOKEN && env.GOOGLE_CLIENT_ID);
  return false;
}
