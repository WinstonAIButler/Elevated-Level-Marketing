import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { connectEnabled, ensureStripeAccount, onboardingLink } from "@/lib/connect";
import { logActivity } from "@/lib/usage";

// Creates the client's Stripe account (first time) and sends them to Stripe-hosted sign-up.
// Also the refresh_url: Stripe sends people back here when a link expires, so it just makes a new one.
export async function GET() {
  const { user, business } = await requireBusiness();
  if (!connectEnabled()) redirect("/dashboard/settings?stripe=off");
  let url: string;
  try {
    const created = !business.stripeAccountId;
    const accountId = await ensureStripeAccount(user, business);
    if (created) await logActivity(business.id, "stripe", "Stripe account created; finishing setup with Stripe");
    url = await onboardingLink(accountId);
  } catch (err) {
    console.error("Stripe Connect onboarding failed", err);
    redirect("/dashboard/settings?stripe=error");
  }
  redirect(url);
}
