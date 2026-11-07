import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { tierForStripePrice } from "@/lib/tiers";
import { recordWalletEntry } from "@/lib/wallet";
import { logActivity } from "@/lib/usage";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Stripe webhook not configured", { status: 501 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      // Ad-spend wallet top-up: credit only the ad amount (the fee stays with Elevated).
      // The session id is the idempotency key, so a retried webhook can't credit twice.
      if (session.metadata?.kind === "wallet_topup") {
        const businessId = session.metadata.businessId;
        const adCents = Number(session.metadata.adCents);
        if (session.payment_status === "paid" && businessId && adCents > 0) {
          await recordWalletEntry({
            businessId,
            kind: "TOPUP",
            amountCents: adCents,
            reference: session.id,
            note: `Added $${(adCents / 100).toFixed(2)} ad spend`,
          });
          await logActivity(businessId, "wallet", `$${(adCents / 100).toFixed(2)} added to your ad wallet`);
        }
        break;
      }
      const userId = session.client_reference_id;
      if (userId && typeof session.customer === "string") {
        await db.user.update({ where: { id: userId }, data: { stripeCustomerId: session.customer } });
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const userId = sub.metadata?.userId;
      const priceId = sub.items.data[0]?.price.id;
      const active = sub.status === "active" || sub.status === "trialing";
      const tier = active && priceId ? tierForStripePrice(priceId) ?? "TRIAL" : "TRIAL";
      const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await db.user.updateMany({
        where: userId ? { id: userId } : { stripeCustomerId: customer },
        data: { tier, subscriptionStatus: sub.status, stripeCustomerId: customer },
      });
      break;
    }
  }
  return Response.json({ received: true });
}
