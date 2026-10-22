import type { Tier } from "@prisma/client";

export type TierInfo = {
  id: Tier;
  name: string;
  price: number;
  tagline: string;
  features: string[];
  limits: { campaignsPerMonth: number; plansPerMonth: number; assessmentsPerMonth: number };
  stripePriceEnv?: string;
};

export const TIERS: Record<Tier, TierInfo> = {
  TRIAL: {
    id: "TRIAL",
    name: "Free Trial",
    price: 0,
    tagline: "See what Elevated can do for your business.",
    features: ["1 marketing assessment", "1 AI marketing plan", "2 AI campaigns"],
    limits: { campaignsPerMonth: 2, plansPerMonth: 1, assessmentsPerMonth: 1 },
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
      "Weekly autopilot content batch",
    ],
    limits: { campaignsPerMonth: 8, plansPerMonth: 2, assessmentsPerMonth: 4 },
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
      "Multi-channel plans with budget allocation",
      "Priority plan refreshes",
    ],
    limits: { campaignsPerMonth: 30, plansPerMonth: 6, assessmentsPerMonth: 10 },
    stripePriceEnv: "STRIPE_PRICE_GROWTH",
  },
  ELITE: {
    id: "ELITE",
    name: "Elite",
    price: 899,
    tagline: "Done-for-you marketing with a strategist in the loop.",
    features: [
      "Everything in Growth",
      "Unlimited AI campaigns",
      "Monthly strategy review with the Elevated team",
      "Custom brand voice tuning",
    ],
    limits: { campaignsPerMonth: 1000, plansPerMonth: 1000, assessmentsPerMonth: 1000 },
    stripePriceEnv: "STRIPE_PRICE_ELITE",
  },
};

export const PAID_TIERS = [TIERS.STARTER, TIERS.GROWTH, TIERS.ELITE];

export function tierForStripePrice(priceId: string): Tier | null {
  for (const tier of PAID_TIERS) {
    if (tier.stripePriceEnv && process.env[tier.stripePriceEnv] === priceId) return tier.id;
  }
  return null;
}
