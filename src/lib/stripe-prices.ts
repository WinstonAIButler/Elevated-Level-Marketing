import "server-only";
import type Stripe from "stripe";
import type { Tier } from "@prisma/client";
import { stripe, stripeEnabled } from "./stripe";
import { PAID_TIERS, TIERS } from "./tiers";

// Finds each plan's current Stripe price, so changing a price in Stripe takes effect on
// the site without editing settings or redeploying. For each plan, in order:
//   1. STRIPE_PRICE_<TIER> env var, if set (manual override)
//   2. an active price with lookup key elm_<tier>_monthly
//   3. the product named "Elevated <Plan>" (e.g. "Elevated Growth"): its default price if
//      it's an active monthly USD price, otherwise its newest active monthly USD price
// Results are cached for 5 minutes per server instance.

export type LivePrice = { tier: Tier; priceId: string; cents: number; productId: string; source: "env" | "lookup_key" | "product" };

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; prices: Partial<Record<Tier, LivePrice>> } | null = null;

const lookupKey = (t: Tier) => `elm_${t.toLowerCase()}_monthly`;
const productName = (t: Tier) => `elevated ${TIERS[t].name.toLowerCase()}`;

function isMonthlyUsd(p: Stripe.Price) {
  return p.active && p.currency === "usd" && p.recurring?.interval === "month" && (p.recurring.interval_count ?? 1) === 1 && p.unit_amount != null;
}

async function load(): Promise<Partial<Record<Tier, LivePrice>>> {
  const out: Partial<Record<Tier, LivePrice>> = {};
  const all: Stripe.Price[] = [];
  for await (const p of stripe().prices.list({ active: true, type: "recurring", limit: 100, expand: ["data.product"] })) {
    all.push(p);
    if (all.length >= 500) break;
  }
  for (const t of PAID_TIERS) {
    const envId = t.stripePriceEnv ? process.env[t.stripePriceEnv] : undefined;
    if (envId) {
      const p = all.find((x) => x.id === envId) ?? (await stripe().prices.retrieve(envId).catch(() => null));
      if (p?.active && p.unit_amount != null) {
        out[t.id] = { tier: t.id, priceId: p.id, cents: p.unit_amount, productId: typeof p.product === "string" ? p.product : p.product.id, source: "env" };
        continue;
      }
    }
    const byKey = all.find((p) => p.lookup_key === lookupKey(t.id) && isMonthlyUsd(p));
    if (byKey) {
      out[t.id] = { tier: t.id, priceId: byKey.id, cents: byKey.unit_amount!, productId: (byKey.product as Stripe.Product).id, source: "lookup_key" };
      continue;
    }
    const onProduct = all.filter((p) => {
      const prod = p.product as Stripe.Product | Stripe.DeletedProduct;
      return "name" in prod && prod.active && prod.name.trim().toLowerCase() === productName(t.id) && isMonthlyUsd(p);
    });
    if (onProduct.length) {
      const prod = onProduct[0].product as Stripe.Product;
      const preferred =
        onProduct.find((p) => p.id === (typeof prod.default_price === "string" ? prod.default_price : prod.default_price?.id)) ??
        onProduct.sort((a, b) => b.created - a.created)[0];
      out[t.id] = { tier: t.id, priceId: preferred.id, cents: preferred.unit_amount!, productId: prod.id, source: "product" };
    }
  }
  return out;
}

/** Current Stripe price for every paid plan that has one. Empty when Stripe isn't set up or can't be reached. */
export async function livePrices(): Promise<Partial<Record<Tier, LivePrice>>> {
  if (!stripeEnabled()) return {};
  if (cache && Date.now() - cache.at < TTL_MS) return cache.prices;
  try {
    const prices = await load();
    cache = { at: Date.now(), prices };
    return prices;
  } catch (err) {
    console.error("Couldn't load Stripe prices", err);
    return cache?.prices ?? {};
  }
}

export async function priceIdForTier(tier: Tier) {
  return (await livePrices())[tier]?.priceId ?? null;
}

/** Monthly price in whole dollars to show for each plan: Stripe's if available, else the list price in tiers.ts. */
export async function displayPrices(): Promise<Record<Tier, number>> {
  const live = await livePrices();
  return Object.fromEntries(
    (Object.keys(TIERS) as Tier[]).map((t) => [t, live[t] ? Math.round(live[t]!.cents / 100) : TIERS[t].price]),
  ) as Record<Tier, number>;
}

/**
 * Which plan a subscription's price belongs to. Works for old prices too (subscribers
 * who haven't moved to a new price), because it matches the product, not the price.
 */
export async function tierForPrice(price: Stripe.Price): Promise<Tier | null> {
  for (const t of PAID_TIERS) {
    if (t.stripePriceEnv && process.env[t.stripePriceEnv] === price.id) return t.id;
    if (price.lookup_key === lookupKey(t.id)) return t.id;
  }
  const productId = typeof price.product === "string" ? price.product : price.product.id;
  const live = await livePrices();
  for (const t of PAID_TIERS) if (live[t.id]?.productId === productId) return t.id;
  const product = typeof price.product === "string" ? await stripe().products.retrieve(price.product) : price.product;
  if ("name" in product) {
    const tierMeta = product.metadata?.tier?.toUpperCase();
    for (const t of PAID_TIERS) if (tierMeta === t.id || product.name.trim().toLowerCase() === productName(t.id)) return t.id;
  }
  return null;
}
