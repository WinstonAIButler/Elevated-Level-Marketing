import { TIERS, PAID_TIERS, type TierInfo } from "./tiers";

// Unit economics for each plan. Pure numbers so the margin test (pricing-model.test.ts)
// fails if a price or limit change pushes any plan under the target margin.
// Assumptions are worst-ish case: the client uses every allowance, every month.

export const TARGET_MARGIN = 0.4;

export const COSTS = {
  // Claude Opus 5.5 at $4 / $20 per million input / output tokens (thinking counts as output).
  ai: {
    assessment: 0.1, // ~3k in, ~4k out
    plan: 0.3, // ~3k in, ~14k out
    campaign: 0.2, // ~2k in, ~9k out
    allocation: 0.08, // ~2k in, ~3.5k out
    adCreative: 0.08, // per channel, ~1.5k in, ~3.5k out
  },
  image: 0.2, // per AI image (OpenAI gpt-image / Gemini), rounded up
  stripePercent: 0.029,
  stripeFixed: 0.3,
  infraPerClient: 3, // hosting + database + bandwidth, per client per month
  laborPerHour: 50, // loaded cost of an Elevated marketing specialist
  laborHours: { TRIAL: 0.25, STARTER: 0.5, GROWTH: 1.5, ELITE: 4.5 } as Record<string, number>,
  // Budget-split proposals and the ads written for them, per month.
  allocationsPerMonth: { TRIAL: 1, STARTER: 4, GROWTH: 8, ELITE: 8 } as Record<string, number>,
  adChannels: { TRIAL: 2, STARTER: 2, GROWTH: 4, ELITE: 5 } as Record<string, number>,
};

export function monthlyCost(t: TierInfo) {
  const l = t.limits;
  const a = COSTS.ai;
  const allocations = COSTS.allocationsPerMonth[t.id];
  const ai =
    l.assessmentsPerMonth * a.assessment +
    l.plansPerMonth * a.plan +
    l.campaignsPerMonth * a.campaign +
    allocations * (a.allocation + COSTS.adChannels[t.id] * a.adCreative);
  const images = l.imagesPerMonth * COSTS.image;
  const stripe = t.price > 0 ? t.price * COSTS.stripePercent + COSTS.stripeFixed : 0;
  const labor = COSTS.laborHours[t.id] * COSTS.laborPerHour;
  const total = ai + images + stripe + COSTS.infraPerClient + labor;
  return { ai, images, stripe, infra: COSTS.infraPerClient, labor, total };
}

export function margin(t: TierInfo) {
  const cost = monthlyCost(t).total;
  return t.price > 0 ? (t.price - cost) / t.price : -Infinity;
}

/** Profit on the wallet management fee for a top-up, after card processing on the whole charge. */
export function walletFeeMargin(adDollars: number, feePercent: number) {
  const fee = (adDollars * feePercent) / 100;
  const charge = adDollars + fee;
  const stripe = charge * COSTS.stripePercent + COSTS.stripeFixed;
  return (fee - stripe) / fee;
}

export function pricingTable() {
  return PAID_TIERS.map((t) => ({ tier: t.name, price: t.price, ...monthlyCost(t), margin: margin(t), adFee: t.adFeePercent }));
}

export const trialCost = () => monthlyCost(TIERS.TRIAL).total;
