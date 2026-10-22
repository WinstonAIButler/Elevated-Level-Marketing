"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Tier } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBusiness, requireUser } from "@/lib/auth";
import { runAutopilot } from "@/lib/autopilot";
import { appUrl, stripe, stripeEnabled } from "@/lib/stripe";
import { TIERS } from "@/lib/tiers";

export async function toggleAutopilot() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { autopilot: !user.autopilot } });
  revalidatePath("/dashboard");
}

export async function runAutopilotNow() {
  const { user, business } = await requireBusiness();
  await runAutopilot(user, business);
  revalidatePath("/dashboard");
}

export async function startCheckout(form: FormData) {
  const user = await requireUser();
  const tier = TIERS[String(form.get("tier")) as Tier];
  const price = tier?.stripePriceEnv ? process.env[tier.stripePriceEnv] : undefined;
  if (!stripeEnabled() || !price) redirect("/dashboard/billing?error=not-configured");
  // Existing subscribers change plans in the Stripe portal so they never end up with two subscriptions.
  if (user.stripeCustomerId && user.tier !== "TRIAL") return openBillingPortal();

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    customer: user.stripeCustomerId ?? undefined,
    customer_email: user.stripeCustomerId ? undefined : user.email,
    client_reference_id: user.id,
    metadata: { userId: user.id },
    subscription_data: { metadata: { userId: user.id } },
    success_url: `${appUrl()}/dashboard/billing?success=1`,
    cancel_url: `${appUrl()}/dashboard/billing`,
  });
  redirect(session.url!);
}

export async function openBillingPortal() {
  const user = await requireUser();
  if (!stripeEnabled() || !user.stripeCustomerId) redirect("/dashboard/billing");
  const portal = await stripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl()}/dashboard/billing`,
  });
  redirect(portal.url);
}
