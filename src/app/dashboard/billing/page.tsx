import { requireUser } from "@/lib/auth";
import { stripeEnabled } from "@/lib/stripe";
import { AD_SPEND_NOTE, PAID_TIERS, TIERS } from "@/lib/tiers";
import { usageThisMonth } from "@/lib/usage";
import { openBillingPortal, startCheckout } from "@/app/actions/account";

export const metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const user = await requireUser();
  const { success, error } = await searchParams;
  const usage = user.business ? await usageThisMonth(user.business.id) : { assessments: 0, plans: 0, campaigns: 0 };
  const current = TIERS[user.tier];
  const payments = stripeEnabled();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Billing</h1>
          <p className="muted">You&apos;re on the <strong>{current.name}</strong> plan{user.subscriptionStatus ? ` (${user.subscriptionStatus})` : ""}.</p>
        </div>
        {user.stripeCustomerId && payments && (
          <form action={openBillingPortal}><button className="btn btn-ghost">Manage subscription</button></form>
        )}
      </div>

      {success && <div className="alert alert-ok" style={{ marginBottom: 20 }}>Thanks! Your subscription is being activated; it can take a few seconds to show here.</div>}
      {(error || !payments) && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          Online payments aren&apos;t switched on yet. Contact us to upgrade your plan.
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Usage this month</h2>
        <table className="simple">
          <tbody>
            <tr><td>Assessments</td><td>{usage.assessments} / {current.limits.assessmentsPerMonth}</td></tr>
            <tr><td>Marketing plans</td><td>{usage.plans} / {current.limits.plansPerMonth}</td></tr>
            <tr><td>Campaigns</td><td>{usage.campaigns} / {current.limits.campaignsPerMonth >= 1000 ? "unlimited" : current.limits.campaignsPerMonth}</td></tr>
          </tbody>
        </table>
      </div>

      <p className="ad-spend-note" style={{ marginBottom: 16 }}>{AD_SPEND_NOTE}</p>
      <div className="grid grid-3">
        {PAID_TIERS.map((t) => (
          <div className={`card ${t.id === user.tier ? "featured" : ""}`} key={t.id}>
            <h3>{t.name}</h3>
            <div className="price">${t.price}<small>/month</small></div>
            <p className="small" style={{ margin: "2px 0 8px", fontWeight: 600 }}>+ your own ad spend</p>
            <ul className="feature-list">{t.features.map((f) => <li key={f}>{f}</li>)}</ul>
            {t.id === user.tier ? (
              <span className="badge badge-good">Current plan</span>
            ) : (
              <form action={startCheckout}>
                <input type="hidden" name="tier" value={t.id} />
                <button className="btn btn-primary" style={{ width: "100%" }} disabled={!payments}>
                  {user.tier === "TRIAL" ? "Choose" : "Switch to"} {t.name}
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
