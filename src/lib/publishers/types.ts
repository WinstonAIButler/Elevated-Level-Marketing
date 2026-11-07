import type { Provider } from "@prisma/client";
import type { TokenSet } from "../oauth";

/** A connection with its token already decrypted (and refreshed if needed). */
export type LiveConnection = {
  provider: Provider;
  accessToken: string;
  accountId: string | null;
  accountName: string | null;
  adAccountId: string | null;
  extra: Record<string, any>;
};

export type PostPayload = {
  text: string;
  hashtags?: string[];
  imageUrl?: string;
  link?: string;
  /** Meta only: which surface of the connection to post to. */
  placement?: "facebook" | "instagram";
};

export type AdPayload = {
  campaignName: string;
  headlines: string[];
  descriptions: string[];
  primaryText: string;
  callToAction: string;
  keywords: string[];
  imageUrl?: string;
  link: string;
};

export type AdMetrics = { spendCents: number; impressions: number; clicks: number; conversions: number };

export type Discovered = {
  accountId: string | null;
  accountName: string | null;
  adAccountId?: string | null;
  extra?: Record<string, any>;
};

/** Where ads run: the client's own ad account, or Elevated's managed account (wallet). */
export type AdTarget = { managed: boolean; businessId: string; businessName: string };

export type Publisher = {
  discover(tokens: TokenSet): Promise<Discovered>;
  publishPost?(conn: LiveConnection, post: PostPayload): Promise<{ externalId: string; externalUrl?: string }>;
  launchAd?(
    conn: LiveConnection | null,
    ad: AdPayload,
    dailyBudgetCents: number,
    target: AdTarget,
  ): Promise<{ externalId: string; externalUrl?: string; adAccountId?: string }>;
  setAdStatus?(conn: LiveConnection | null, externalId: string, active: boolean, target: AdTarget): Promise<void>;
  adMetrics?(conn: LiveConnection | null, externalId: string, day: string, target: AdTarget): Promise<AdMetrics>;
};

export function postText(p: PostPayload) {
  const tags = (p.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  return [p.text.trim(), tags].filter(Boolean).join("\n\n");
}
