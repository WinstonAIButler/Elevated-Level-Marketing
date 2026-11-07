"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { appUrl, stripe, stripeEnabled } from "@/lib/stripe";
import { approveAllocation, proposeAllocation, rejectAllocation } from "@/lib/publishing";
import { MAX_TOPUP_CENTS, MIN_TOPUP_CENTS, topupBreakdown, topupFeePercent } from "@/lib/wallet";
import { logActivity } from "@/lib/usage";
import { TIERS } from "@/lib/tiers";

export type ActionState = { error?: string; ok?: string } | undefined;

const errorText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");

export async function setBudget(_: ActionState, form: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  const budget = Math.round(Number(form.get("monthlyBudget")));
  const mode = form.get("adSpendMode") === "OWN_ACCOUNTS" ? "OWN_ACCOUNTS" : "WALLET";
  if (!Number.isFinite(budget) || budget < 0 || budget > 1_000_000) return { error: "Enter a monthly ad budget in dollars." };
  const changed = budget !== business.monthlyBudget || mode !== business.adSpendMode;
  await db.business.update({ where: { id: business.id }, data: { monthlyBudget: budget, adSpendMode: mode } });
  if (changed) {
    await logActivity(business.id, "budget", `Ad budget set to $${budget.toLocaleString()}/month, paid ${mode === "WALLET" ? "from your Elevated ad wallet" : "through your own ad accounts"}`);
  }
  revalidatePath("/dashboard/ad-spend");
  return { ok: "Saved." };
}

export async function startTopup(form: FormData) {
  const { user, business } = await requireBusiness();
  const adCents = Math.round(Number(form.get("amount")) * 100);
  if (!stripeEnabled()) redirect("/dashboard/ad-spend?error=payments-off");
  if (!Number.isFinite(adCents) || adCents < MIN_TOPUP_CENTS || adCents > MAX_TOPUP_CENTS) {
    redirect(`/dashboard/ad-spend?error=amount`);
  }
  const fee = topupFeePercent(TIERS[user.tier].adFeePercent);
  const b = topupBreakdown(adCents, fee);
  const lineItems = [
    { price_data: { currency: "usd", unit_amount: b.adCents, product_data: { name: "Ad spend (credited to your ad wallet)" } }, quantity: 1 },
    ...(b.feeCents > 0
      ? [{ price_data: { currency: "usd", unit_amount: b.feeCents, product_data: { name: `Ad management fee (${fee}%)` } }, quantity: 1 }]
      : []),
  ];
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    customer: user.stripeCustomerId ?? undefined,
    customer_email: user.stripeCustomerId ? undefined : user.email,
    client_reference_id: user.id,
    metadata: { kind: "wallet_topup", businessId: business.id, adCents: String(b.adCents), feeCents: String(b.feeCents) },
    payment_intent_data: { metadata: { kind: "wallet_topup", businessId: business.id }, description: `Ad wallet top-up for ${business.name}` },
    success_url: `${appUrl()}/dashboard/ad-spend?topup=1`,
    cancel_url: `${appUrl()}/dashboard/ad-spend`,
  });
  redirect(session.url!);
}

export async function requestAllocation(_: ActionState, form: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  try {
    await proposeAllocation(business, String(form.get("note") ?? "") || null);
  } catch (err) {
    return { error: errorText(err) };
  }
  revalidatePath("/dashboard/ad-spend");
  return { ok: "New split ready for your review below." };
}

export async function decideAllocation(_: ActionState, form: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  const id = String(form.get("id"));
  try {
    if (form.get("decision") === "approve") {
      await approveAllocation(business, id);
      revalidatePath("/dashboard/ad-spend");
      revalidatePath("/dashboard/approvals");
      return { ok: "Approved. Your ads are written and waiting in Approvals." };
    }
    await rejectAllocation(business, id, String(form.get("note") ?? "").slice(0, 1000));
  } catch (err) {
    return { error: errorText(err) };
  }
  revalidatePath("/dashboard/ad-spend");
  return { ok: "Thanks. Here's a revised split based on your feedback." };
}
