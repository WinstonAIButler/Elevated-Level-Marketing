import Link from "next/link";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { CHANNELS, PROVIDERS } from "@/lib/channels";
import { connectEnabled, recentSales, refreshStripeStatus } from "@/lib/connect";
import { formatDate } from "@/lib/format";
import { TIERS } from "@/lib/tiers";
import { checkStripe } from "@/app/actions/settings";
import { SubmitButton } from "@/components/SubmitButton";
import { NameForm, PasswordForm } from "./Forms";

export const metadata = { title: "Settings" };

const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const { user, business: initial } = await requireBusiness();
  const { stripe: stripeParam } = await searchParams;
  let business = initial;
  // Coming back from Stripe sign-up: re-read the account so the status is current.
  if (stripeParam === "returned" && business.stripeAccountId) {
    business = await refreshStripeStatus(business).catch(() => business);
  }
  const conns = await db.channelConnection.findMany({ where: { businessId: business.id } });
  const byProvider = new Map(conns.map((c) => [c.provider, c]));
  const sales = business.stripeChargesEnabled ? await recentSales(business.stripeAccountId!).catch(() => null) : null;
  const stripeOn = connectEnabled();

  const stripeState = !business.stripeAccountId
    ? "none"
    : business.stripeChargesEnabled
      ? "active"
      : business.stripeDetailsSubmitted
        ? "review"
        : "incomplete";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Your login, the accounts we market on, and your Stripe account.</p>
        </div>
      </div>

      {stripeParam === "error" && <div className="alert alert-error" style={{ marginBottom: 20 }}>We couldn&apos;t open Stripe just now. Please try again in a minute.</div>}
      {stripeParam === "off" && <div className="alert alert-info" style={{ marginBottom: 20 }}>Stripe accounts aren&apos;t available yet. We&apos;ll let you know when they are.</div>}
      {stripeParam === "returned" && stripeState === "active" && <div className="alert alert-ok" style={{ marginBottom: 20 }}>Your Stripe account is ready to take payments.</div>}
      {stripeParam === "returned" && stripeState !== "active" && <div className="alert alert-info" style={{ marginBottom: 20 }}>Thanks. Stripe may still need a few details or a short review; the status below updates as it goes.</div>}

      <div className="card" style={{ marginBottom: 20 }} id="stripe">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Stripe account</h2>
          <span className={`badge ${stripeState === "active" ? "badge-good" : stripeState === "none" ? "badge-dark" : "badge-warn"}`}>
            {{ none: "Not set up", incomplete: "Setup not finished", review: "In review with Stripe", active: "Active" }[stripeState]}
          </span>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Your own Stripe account for taking payments from your customers, set up through Elevated. It belongs to you: you log
          in to Stripe directly, payouts go to your bank, and Stripe&apos;s fees are charged to your account. Being connected to
          Elevated lets us show the sales your marketing brings in.
        </p>
        {stripeState === "active" && sales && (
          <div className="row" style={{ gap: 32, margin: "8px 0 16px" }}>
            <div><div className="muted small">Sales, last {sales.days} days</div><div className="stat">{usd(sales.cents)}</div></div>
            <div><div className="muted small">Payments</div><div className="stat">{sales.count.toLocaleString()}</div></div>
          </div>
        )}
        <div className="row">
          {stripeState === "none" && (
            <a className={`btn btn-primary ${stripeOn ? "" : "disabled"}`} href={stripeOn ? "/api/stripe/connect" : undefined} aria-disabled={!stripeOn}>
              Set up my Stripe account
            </a>
          )}
          {(stripeState === "incomplete" || stripeState === "review") && (
            <a className="btn btn-primary" href="/api/stripe/connect">{stripeState === "incomplete" ? "Finish Stripe setup" : "Review details with Stripe"}</a>
          )}
          {stripeState !== "none" && (
            <a className="btn btn-ghost" href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">Open Stripe Dashboard</a>
          )}
          {stripeState !== "none" && stripeState !== "active" && (
            <form action={checkStripe}><SubmitButton className="btn btn-ghost" pendingText="Checking…">Check status</SubmitButton></form>
          )}
        </div>
        {business.stripeCheckedAt && <p className="small muted" style={{ marginTop: 10 }}>Status checked {formatDate(business.stripeCheckedAt)}.</p>}
        {stripeState === "none" && (
          <p className="small muted" style={{ marginTop: 10 }}>Takes about 5 minutes on Stripe&apos;s secure site. Have your business details and bank account ready.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row between">
          <h2 style={{ margin: 0 }}>Linked accounts</h2>
          <Link href="/dashboard/channels" className="btn btn-primary btn-sm">Add or manage accounts</Link>
        </div>
        <table className="simple" style={{ marginTop: 12 }}>
          <tbody>
            {PROVIDERS.map((p) => {
              const c = byProvider.get(p);
              const label = !c ? "Not set up" : c.status === "active" ? "Connected" : c.status === "linked" ? "Linked" : "Reconnect needed";
              return (
                <tr key={p}>
                  <td><strong>{CHANNELS[p].name}</strong>{c && <div className="small muted">{c.accountName ?? c.profileUrl}</div>}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className={`badge ${!c ? "badge-dark" : c.status === "active" || c.status === "linked" ? "badge-good" : "badge-bad"}`}>{label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Your login</h2>
          <p className="small muted">Email: <strong>{user.email}</strong> · Plan: <Link href="/dashboard/billing">{TIERS[user.tier].name}</Link></p>
          <NameForm name={user.name} />
        </div>
        <div className="card">
          <h2>Password</h2>
          <PasswordForm />
        </div>
      </div>
    </>
  );
}
