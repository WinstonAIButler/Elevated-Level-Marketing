// Pure wallet math (no database), shared by the server and tests.

export const MIN_TOPUP_CENTS = 5_000; // $50
export const MAX_TOPUP_CENTS = 2_500_000; // $25,000 per payment

/**
 * Management fee on ad-wallet top-ups: the plan's rate (12% Starter, 10% Growth, 8% Elite),
 * unless AD_MANAGEMENT_FEE_PERCENT overrides it for everyone.
 */
export function topupFeePercent(planPercent: number, env: Record<string, string | undefined> = process.env) {
  if (env.AD_MANAGEMENT_FEE_PERCENT === undefined || env.AD_MANAGEMENT_FEE_PERCENT === "") return planPercent;
  const raw = Number(env.AD_MANAGEMENT_FEE_PERCENT);
  return Number.isFinite(raw) && raw >= 0 && raw <= 100 ? raw : planPercent;
}

/** What the client pays for a top-up: the ad money (all credited to the wallet) plus the fee. */
export function topupBreakdown(adCents: number, feePercent: number) {
  const feeCents = Math.round((adCents * feePercent) / 100);
  return { adCents, feeCents, totalCents: adCents + feeCents };
}

/** Days the balance covers at the given daily spend (Infinity when nothing is running). */
export function fundedDays(balanceCents: number, dailySpendCents: number) {
  if (dailySpendCents <= 0) return Infinity;
  return Math.max(0, balanceCents) / dailySpendCents;
}

/** Ads pause when the wallet can't cover this many more days. */
export const LOW_BALANCE_DAYS = 2;
/** A new ad only launches when the wallet covers at least this many days of it. */
export const LAUNCH_MIN_DAYS = 3;
