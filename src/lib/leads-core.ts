// Leads & Results: pure helpers (no database), shared by server code and tests.

export const CHANNELS = [
  "google",
  "google_ads",
  "google_business",
  "facebook",
  "instagram",
  "linkedin",
  "x",
  "tiktok",
  "ai_search",
  "website",
  "email",
  "referral",
  "other",
] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  google: "Google search",
  google_ads: "Google Ads",
  google_business: "Google Business Profile",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
  tiktok: "TikTok",
  ai_search: "AI assistants",
  website: "Website",
  email: "Email",
  referral: "Referral / word of mouth",
  other: "Other",
};

/** Every link Elevated publishes carries utm_campaign starting with this. */
export const ELEVATED_CAMPAIGN_PREFIX = "elevated";

const RULES: [RegExp, Channel][] = [
  [/chatgpt|openai|perplexity|claude|gemini|copilot|\bai\b|bard/i, "ai_search"],
  [/google.?business|\bgbp\b|google.?maps|maps\.google|business\.google|gmb/i, "google_business"],
  [/google.?ads|adwords|\bppc\b|\bcpc\b|gclid|google.?cpc/i, "google_ads"],
  [/instagram|\big\b/i, "instagram"],
  [/facebook|\bfb\b|meta/i, "facebook"],
  [/linkedin|lnkd/i, "linkedin"],
  [/tiktok/i, "tiktok"],
  [/twitter|\bx\.com\b|^x$|t\.co/i, "x"],
  [/google|bing|yahoo|duckduckgo|organic|seo|search/i, "google"],
  [/mail|newsletter|klaviyo|mailchimp/i, "email"],
  [/referr|word of mouth|friend|recommend/i, "referral"],
  [/website|web form|contact form|site/i, "website"],
];

/** Maps whatever a form, CRM or spreadsheet says about the source onto one of our channels. */
export function normalizeSource(...hints: (string | null | undefined)[]): Channel {
  for (const hint of hints) {
    const h = (hint ?? "").trim();
    if (!h) continue;
    if ((CHANNELS as readonly string[]).includes(h)) return h as Channel;
    for (const [re, ch] of RULES) if (re.test(h)) return ch;
  }
  return "other";
}

/** utm_source value used for each platform Elevated publishes to. */
export const UTM_SOURCE: Record<string, string> = {
  META: "facebook",
  INSTAGRAM: "instagram",
  GOOGLE_ADS: "google",
  GOOGLE_BUSINESS: "google_business",
  LINKEDIN: "linkedin",
  TIKTOK: "tiktok",
  X: "x",
};

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "campaign";
}

/** Adds Elevated's tracking parameters to a link unless it already has its own. */
export function tagLink(url: string | undefined, source: string, medium: "social" | "cpc" | "local", campaign: string) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.searchParams.has("utm_source")) return url;
    u.searchParams.set("utm_source", source);
    u.searchParams.set("utm_medium", medium);
    u.searchParams.set("utm_campaign", `${ELEVATED_CAMPAIGN_PREFIX}-${slug(campaign)}`);
    return u.toString();
  } catch {
    return url;
  }
}

export function isElevatedCampaign(utmCampaign: string | null | undefined) {
  return Boolean(utmCampaign && utmCampaign.toLowerCase().startsWith(ELEVATED_CAMPAIGN_PREFIX));
}

export function parseMoneyToCents(v: string | null | undefined) {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

export type LeadStatusValue = "NEW" | "CONTACTED" | "WON" | "LOST";

export function parseStatus(v: string | null | undefined): LeadStatusValue {
  const s = String(v ?? "").toLowerCase();
  if (/won|closed.?won|paid|customer|client|complete|sold|booked|converted|active/.test(s)) return "WON";
  if (/lost|closed.?lost|dead|declin|unqualified|disqualif|churn|cancel/.test(s)) return "LOST";
  if (/contact|qualif|working|progress|open|follow|negotiat|proposal|quote|estimate|scheduled/.test(s)) return "CONTACTED";
  return "NEW";
}

export function parseDate(v: string | null | undefined): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) || d.getFullYear() < 1990 || d.getTime() > Date.now() + 86_400_000 ? null : d;
}

// ---------------------------------------------------------------------------
// Results

export type ResultLead = { occurredAt: Date; status: LeadStatusValue; valueCents: number; wonAt: Date | null; source: string; elevated: boolean };

/**
 * Before vs since Elevated: average leads per week, won customers and revenue per month,
 * Elevated-attributed leads and revenue, and return on spend.
 */
export function resultsSummary(leads: ResultLead[], opts: { startedAt: Date; now?: Date; spendCents: number; baselineWeeks?: number }) {
  const now = opts.now ?? new Date();
  const WEEK = 7 * 86_400_000;
  const baselineWeeks = opts.baselineWeeks ?? 12;
  const baselineFrom = new Date(opts.startedAt.getTime() - baselineWeeks * WEEK);
  const weeksSince = Math.max(1, (now.getTime() - opts.startedAt.getTime()) / WEEK);

  const before = leads.filter((l) => l.occurredAt >= baselineFrom && l.occurredAt < opts.startedAt);
  const after = leads.filter((l) => l.occurredAt >= opts.startedAt);
  const won = (ls: ResultLead[]) => ls.filter((l) => l.status === "WON");
  const sum = (ls: ResultLead[]) => ls.reduce((a, l) => a + l.valueCents, 0);

  const afterWon = won(after);
  const elevatedLeads = after.filter((l) => l.elevated);
  const elevatedRevenue = sum(won(elevatedLeads));
  const perWeekBefore = before.length / baselineWeeks;
  const perWeekAfter = after.length / weeksSince;

  const bySource = new Map<string, { leads: number; won: number; revenueCents: number }>();
  for (const l of after) {
    const s = bySource.get(l.source) ?? { leads: 0, won: 0, revenueCents: 0 };
    s.leads++;
    if (l.status === "WON") {
      s.won++;
      s.revenueCents += l.valueCents;
    }
    bySource.set(l.source, s);
  }

  return {
    baselineWeeks,
    weeksSince: Math.round(weeksSince * 10) / 10,
    hasBaseline: before.length > 0,
    leadsPerWeekBefore: Math.round(perWeekBefore * 10) / 10,
    leadsPerWeekAfter: Math.round(perWeekAfter * 10) / 10,
    leadChangePct: perWeekBefore > 0 ? Math.round(((perWeekAfter - perWeekBefore) / perWeekBefore) * 100) : null,
    leadsSince: after.length,
    wonSince: afterWon.length,
    revenueSinceCents: sum(afterWon),
    elevatedLeads: elevatedLeads.length,
    elevatedRevenueCents: elevatedRevenue,
    spendCents: opts.spendCents,
    // Return on spend counts only revenue we can trace to Elevated's work.
    roi: opts.spendCents > 0 ? Math.round((elevatedRevenue / opts.spendCents) * 100) / 100 : null,
    costPerLeadCents: elevatedLeads.length && opts.spendCents > 0 ? Math.round(opts.spendCents / elevatedLeads.length) : null,
    bySource: [...bySource.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.leads - a.leads),
  };
}
