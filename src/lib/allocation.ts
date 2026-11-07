import type { Provider } from "@prisma/client";
import { CHANNELS } from "./channels";

// Budget-split math. Pure functions so they can be unit tested; the AI proposal in
// ai.ts is always passed through normalizeSplits() before anything is saved.

/** Below this a channel can't gather enough data to learn, so we don't split that thin. */
export const MIN_CHANNEL_CENTS = 15_000;

export type ChannelPerf = { provider: Provider; spendCents: number; clicks: number; conversions: number };

export type Split = {
  provider: Provider;
  percent: number;
  cents: number;
  reason: string;
  expectedResult: string;
};

export type RawSplit = { provider: Provider; percent: number; reason: string; expectedResult: string };

const B2B = /\bb2b\b|business owners|companies|enterprise|professionals|decision[- ]makers|saas|agencies|contractors|firms|procurement|hr managers/i;

export function looksB2B(text: string) {
  return B2B.test(text);
}

const BASE_WEIGHTS: Record<"local" | "b2b", Partial<Record<Provider, number>>> = {
  local: { GOOGLE_ADS: 45, META: 40, TIKTOK: 10, X: 3, LINKEDIN: 2 },
  b2b: { GOOGLE_ADS: 40, LINKEDIN: 30, META: 20, X: 5, TIKTOK: 5 },
};

const BASE_REASON: Partial<Record<Provider, string>> = {
  GOOGLE_ADS: "Reaches people already searching for what you offer, so it usually brings the highest-intent leads.",
  META: "Facebook and Instagram are the cheapest way to reach your local audience repeatedly and retarget site visitors.",
  LINKEDIN: "Targets by job title and company, which suits selling to other businesses.",
  TIKTOK: "Low-cost reach with younger audiences; good for awareness when you have video.",
  X: "Small test budget to reach people following conversations in your industry.",
};

const BASE_EXPECTED: Partial<Record<Provider, string>> = {
  GOOGLE_ADS: "Calls, form fills and website visits from searchers",
  META: "Reach, website visits and messages from your local audience",
  LINKEDIN: "Leads from decision-makers in your target companies",
  TIKTOK: "Video views and new followers",
  X: "Engagement and profile visits",
};

/** Cost per result for a channel, or null when there isn't enough data to judge. */
export function costPerResult(p: ChannelPerf): number | null {
  if (p.spendCents < 5_000) return null; // under $50 of spend is noise
  if (p.conversions >= 3) return p.spendCents / p.conversions;
  if (p.clicks >= 30) return (p.spendCents / p.clicks) * 20; // rough stand-in: ~5% of clicks convert
  return null;
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Turns weights into whole percents that sum to exactly 100 and cents that sum to exactly the total. */
function finalize(entries: { provider: Provider; weight: number; reason: string; expectedResult: string }[], totalCents: number): Split[] {
  const sum = entries.reduce((a, e) => a + e.weight, 0);
  if (!entries.length || sum <= 0 || totalCents <= 0) return [];
  const exact = entries.map((e) => (e.weight / sum) * 100);
  const percents = exact.map(Math.floor);
  let left = 100 - percents.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) percents[order[k][1]]++;

  const cents = percents.map((p) => Math.floor((totalCents * p) / 100));
  cents[0] += totalCents - cents.reduce((a, b) => a + b, 0);
  return entries
    .map((e, i) => ({ provider: e.provider, percent: percents[i], cents: cents[i], reason: e.reason, expectedResult: e.expectedResult }))
    .filter((s) => s.percent > 0)
    .sort((a, b) => b.cents - a.cents);
}

/** How many channels a budget can support at MIN_CHANNEL_CENTS each (at least one). */
export function maxChannels(totalCents: number) {
  return Math.max(1, Math.floor(totalCents / MIN_CHANNEL_CENTS));
}

/**
 * Rule-based split, used without AI and as the baseline the AI sees. Starts from
 * industry weights, then shifts money toward channels with a lower cost per result.
 */
export function proposeSplit(input: {
  totalCents: number;
  candidates: Provider[];
  perf: ChannelPerf[];
  b2b: boolean;
}): Split[] {
  const base = BASE_WEIGHTS[input.b2b ? "b2b" : "local"];
  const costs = new Map(input.perf.map((p) => [p.provider, costPerResult(p)]));
  const known = [...costs.values()].filter((c): c is number => c !== null);
  const mid = known.length >= 2 ? median(known) : null;

  let entries = input.candidates
    .filter((p) => CHANNELS[p].paid && (base[p] ?? 0) > 0)
    .map((provider) => {
      let weight = base[provider] ?? 0;
      let reason = BASE_REASON[provider] ?? "";
      const cost = costs.get(provider) ?? null;
      if (mid !== null && cost !== null) {
        const factor = Math.min(2, Math.max(0.5, mid / cost));
        weight *= factor;
        const dollars = (cost / 100).toFixed(2);
        if (factor > 1.1) reason += ` Last 30 days it delivered results at about $${dollars} each, cheaper than your other channels, so it gets more.`;
        else if (factor < 0.9) reason += ` Last 30 days results cost about $${dollars} each, more than your other channels, so it gets less.`;
      }
      return { provider, weight, reason, expectedResult: BASE_EXPECTED[provider] ?? "" };
    })
    .sort((a, b) => b.weight - a.weight);

  entries = entries.slice(0, maxChannels(input.totalCents));
  return finalize(entries, input.totalCents);
}

/**
 * Cleans an AI-proposed split: drops unknown or unpaid channels, merges duplicates,
 * caps the channel count to what the budget supports, and makes the numbers add up.
 */
export function normalizeSplits(raw: RawSplit[], totalCents: number, candidates: Provider[]): Split[] {
  const allowed = new Set(candidates.filter((p) => CHANNELS[p].paid));
  const merged = new Map<Provider, RawSplit>();
  for (const s of raw) {
    if (!allowed.has(s.provider) || !(s.percent > 0)) continue;
    const prev = merged.get(s.provider);
    merged.set(s.provider, prev ? { ...prev, percent: prev.percent + s.percent } : s);
  }
  const entries = [...merged.values()]
    .sort((a, b) => b.percent - a.percent)
    .slice(0, maxChannels(totalCents))
    .map((s) => ({ provider: s.provider, weight: s.percent, reason: s.reason, expectedResult: s.expectedResult }));
  return finalize(entries, totalCents);
}

/** Daily budget for one channel's campaign, spreading its monthly share over the days left in the month. */
export function dailyBudgetCents(monthlyCents: number, now = new Date()) {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;
  return Math.max(100, Math.floor(monthlyCents / Math.max(daysLeft, 1)));
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
