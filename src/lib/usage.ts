import "server-only";
import type { User } from "@prisma/client";
import { db } from "./db";
import { TIERS } from "./tiers";

type Kind = "assessments" | "plans" | "campaigns";

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function usageThisMonth(businessId: string) {
  const since = { gte: startOfMonth() };
  const [assessments, plans, campaigns] = await Promise.all([
    db.assessment.count({ where: { businessId, createdAt: since } }),
    db.marketingPlan.count({ where: { businessId, createdAt: since } }),
    db.campaign.count({ where: { businessId, createdAt: since } }),
  ]);
  return { assessments, plans, campaigns };
}

/** Throws a user-facing error when the account has used its monthly allowance. */
export async function assertWithinLimit(user: Pick<User, "tier">, businessId: string, kind: Kind) {
  const limits = TIERS[user.tier].limits;
  const used = await usageThisMonth(businessId);
  const limit = { assessments: limits.assessmentsPerMonth, plans: limits.plansPerMonth, campaigns: limits.campaignsPerMonth }[kind];
  if (used[kind] >= limit) {
    throw new Error(
      `Your ${TIERS[user.tier].name} plan includes ${limit} ${kind} per month. Upgrade on the Billing page to create more.`,
    );
  }
}

export function logActivity(businessId: string, kind: string, message: string) {
  return db.activity.create({ data: { businessId, kind, message } });
}
