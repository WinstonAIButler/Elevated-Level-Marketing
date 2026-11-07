import "server-only";
import type { Business, User } from "@prisma/client";
import { db } from "./db";
import { appUrl, stripe, stripeEnabled } from "./stripe";

// Stripe Connect: each client gets their own Stripe account under Elevated's platform.
// Controller properties match a Standard account: the client logs in to the full Stripe
// Dashboard with their own credentials, pays their own Stripe fees, and Stripe (not
// Elevated) covers losses from unrecoverable negative balances. Elevated can read the
// account through the platform to report sales driven by marketing.
// Docs: docs.stripe.com/connect/migrate-to-controller-properties, /connect/hosted-onboarding.

export const connectEnabled = () => stripeEnabled();

export async function ensureStripeAccount(user: Pick<User, "email">, business: Business) {
  if (business.stripeAccountId) return business.stripeAccountId;
  const website = business.website ? (/^https?:\/\//.test(business.website) ? business.website : `https://${business.website}`) : undefined;
  const account = await stripe().accounts.create({
    email: user.email,
    business_profile: { name: business.name, ...(website ? { url: website } : {}) },
    controller: {
      stripe_dashboard: { type: "full" },
      fees: { payer: "account" },
      losses: { payments: "stripe" },
    },
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    metadata: { businessId: business.id },
  });
  // Guard against a double click creating two accounts: only the first write wins.
  const res = await db.business.updateMany({
    where: { id: business.id, stripeAccountId: null },
    data: { stripeAccountId: account.id },
  });
  if (!res.count) {
    const current = await db.business.findUnique({ where: { id: business.id }, select: { stripeAccountId: true } });
    return current!.stripeAccountId!;
  }
  return account.id;
}

/** Single-use link into Stripe-hosted sign-up. Never email it; only redirect the signed-in owner. */
export async function onboardingLink(accountId: string) {
  const link = await stripe().accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl()}/api/stripe/connect`,
    return_url: `${appUrl()}/dashboard/settings?stripe=returned`,
    type: "account_onboarding",
  });
  return link.url;
}

/** Re-reads the account from Stripe and stores whether it can take payments. */
export async function refreshStripeStatus(business: Business) {
  if (!business.stripeAccountId) return business;
  const account = await stripe().accounts.retrieve(business.stripeAccountId);
  return db.business.update({
    where: { id: business.id },
    data: {
      stripeDetailsSubmitted: Boolean(account.details_submitted),
      stripeChargesEnabled: Boolean(account.charges_enabled),
      stripeCheckedAt: new Date(),
    },
  });
}

/** Successful, non-refunded card sales on the client's account in the last N days (USD cents). */
export async function recentSales(accountId: string, days = 30) {
  const since = Math.floor(Date.now() / 1000) - days * 86_400;
  let cents = 0;
  let count = 0;
  for await (const charge of stripe().charges.list({ created: { gte: since }, limit: 100 }, { stripeAccount: accountId })) {
    if (charge.status !== "succeeded" || charge.currency !== "usd") continue;
    cents += charge.amount - charge.amount_refunded;
    count++;
    if (count >= 2000) break;
  }
  return { cents, count, days };
}
