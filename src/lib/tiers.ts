import type { Tier } from "@prisma/client";

export type TierInfo = {
  id: Tier;
  name: string;
  price: number;
  tagline: string;
  features: string[];
  limits: { campaignsPerMonth: number; plansPerMonth: number; assessmentsPerMonth: number; imagesPerMonth: number };
  /** Management fee on ad-wallet top-ups, percent of the ad amount. Lower on higher plans. */
  adFeePercent: number;
  stripePriceEnv?: string;
};

export const TIERS: Record<Tier, TierInfo> = {
  TRIAL: {
    id: "TRIAL",
    name: "Free Trial",
    price: 0,
    tagline: "See what Elevated can do for your business.",
    features: ["1 marketing assessment", "1 AI marketing plan", "2 AI campaigns", "5 AI images"],
    limits: { campaignsPerMonth: 2, plansPerMonth: 1, assessmentsPerMonth: 1, imagesPerMonth: 5 },
    adFeePercent: 12,
  },
  STARTER: {
    id: "STARTER",
    name: "Starter",
    price: 149,
    tagline: "For solo owners who want marketing on autopilot.",
    features: [
      "Monthly re-assessment",
      "Rolling 12-week marketing plan",
      "8 AI campaigns per month",
      "Weekly autopilot content batch, auto-posted after your approval",
      "60 AI images per month",
      "12% ad management fee",
    ],
    limits: { campaignsPerMonth: 8, plansPerMonth: 2, assessmentsPerMonth: 4, imagesPerMonth: 60 },
    adFeePercent: 12,
    stripePriceEnv: "STRIPE_PRICE_STARTER",
  },
  GROWTH: {
    id: "GROWTH",
    name: "Growth",
    price: 399,
    tagline: "For growing teams running several channels at once.",
    features: [
      "Everything in Starter",
      "30 AI campaigns per month",
      "Ad budget split across channels by performance",
      "200 AI images per month",
      "10% ad management fee",
    ],
    limits: { campaignsPerMonth: 30, plansPerMonth: 6, assessmentsPerMonth: 10, imagesPerMonth: 200 },
    adFeePercent: 10,
    stripePriceEnv: "STRIPE_PRICE_GROWTH",
  },
  ELITE: {
    id: "ELITE",
    name: "Elite",
    price: 899,
    tagline: "Done-for-you marketing with a strategist in the loop.",
    features: [
      "Everything in Growth",
      "Up to 200 AI campaigns per month",
      "Monthly strategy review with the Elevated team",
      "TikTok, LinkedIn and X ads run by our team",
      "500 AI images per month",
      "8% ad management fee",
    ],
    limits: { campaignsPerMonth: 200, plansPerMonth: 30, assessmentsPerMonth: 30, imagesPerMonth: 500 },
    adFeePercent: 8,
    stripePriceEnv: "STRIPE_PRICE_ELITE",
  },
};

// Plan prices cover the platform and our service only. Ad spend is separate: clients
// either prepay it into their Elevated ad wallet or connect their own ad accounts.
export const AD_SPEND_NOTE =
  "Ad spend is not included. You set the budget and approve how it's split, then either add it to your Elevated ad wallet or connect your own Google and Meta ad accounts.";

export const PAID_TIERS = [TIERS.STARTER, TIERS.GROWTH, TIERS.ELITE];

export function tierForStripePrice(priceId: string): Tier | null {
  for (const tier of PAID_TIERS) {
    if (tier.stripePriceEnv && process.env[tier.stripePriceEnv] === priceId) return tier.id;
  }
  return null;
}
