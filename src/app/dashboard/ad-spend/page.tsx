import Link from "next/link";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { CHANNELS } from "@/lib/channels";
import { formatDate } from "@/lib/format";
import { costPerResult, type Split } from "@/lib/allocation";
import { channelPerformance } from "@/lib/publishing";
import { stripeEnabled } from "@/lib/stripe";
import { feeNote, MIN_TOPUP_CENTS } from "@/lib/wallet";
import { fundedDays } from "@/lib/wallet-math";
import { startTopup } from "@/app/actions/adspend";
import { TIERS } from "@/lib/tiers";
import { BudgetForm, DecideSplit, RequestSplit } from "./Forms";

export const metadata = { title: "Ad spend" };

const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function AdSpendPage({ searchParams }: { searchParams: Promise<{ topup?: string; error?: string }> }) {
  const { user, business } = await requireBusiness();
  const { topup, error } = await searchParams;
  const [allocation, entries, perf, live] = await Promise.all([
    db.budgetAllocation.findFirst({
      where: { businessId: business.id, status: { in: ["PROPOSED", "APPROVED"] } },
      orderBy: { createdAt: "desc" },
    }),
    db.walletEntry.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    channelPerformance(business.id),
    db.publishItem.aggregate({ where: { businessId: business.id, kind: "AD", status: "PUBLISHED" }, _sum: { dailyBudgetCents: true } }),
  ]);
  const wallet = business.adSpendMode === "WALLET";
  const daily = live._sum.dailyBudgetCents ?? 0;
  const days = fundedDays(business.walletBalanceCents, daily);
  const splits = (allocation?.splits as Split[] | undefined) ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ad spend</h1>
          <p className="muted">Set your budget and we work out where it does the most good. Nothing is spent until you approve it.</p>
        </div>
      </div>

      {topup && <div className="alert alert-ok" style={{ marginBottom: 20 }}>Payment received. Your wallet updates within a minute.</div>}
      {error === "amount" && <div className="alert alert-error" style={{ marginBottom: 20 }}>Choose an amount between {usd(MIN_TOPUP_CENTS)} and $25,000.</div>}
      {error === "payments-off" && <div className="alert alert-info" style={{ marginBottom: 20 }}>Online payments aren&apos;t switched on yet. Contact us to add ad funds.</div>}

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2>Budget</h2>
          <BudgetForm budget={business.monthlyBudget} mode={business.adSpendMode} />
        </div>

        {wallet ? (
          <div className="card">
            <h2>Ad wallet</h2>
            <div className="stat"><strong style={{ fontSize: "2rem" }}>{usd(business.walletBalanceCents)}</strong></div>
            <p className="muted small">
              {daily > 0
                ? `Live ads spend up to ${usd(daily)}/day, so this covers about ${Number.isFinite(days) ? Math.floor(days) : "∞"} more day${Math.floor(days) === 1 ? "" : "s"}. Ads pause automatically before the wallet runs out and restart when you add funds.`
                : "No ads are running yet."}
            </p>
            <form action={startTopup} className="stack">
              <div className="field">
                <label htmlFor="amount">Add funds (USD)</label>
                <input id="amount" name="amount" type="number" min={MIN_TOPUP_CENTS / 100} max={25000} step={1} defaultValue={Math.max(business.monthlyBudget, MIN_TOPUP_CENTS / 100)} required />
                <span className="hint">{feeNote(TIERS[user.tier].adFeePercent)}{user.tier !== "ELITE" && " Higher plans pay a lower fee."}</span>
              </div>
              <button className="btn btn-primary" disabled={!stripeEnabled()}>Add funds</button>
            </form>
          </div>
        ) : (
          <div className="card">
            <h2>Your ad accounts</h2>
            <p className="muted">Ads run in your own Google Ads and Meta ad accounts and the platforms bill your card. We keep each channel within the budget you approve.</p>
            <Link href="/dashboard/channels" className="btn btn-ghost">Connect ad accounts →</Link>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row between">
          <h2 style={{ margin: 0 }}>Where your budget goes</h2>
          {allocation && (
            <span className={`badge ${allocation.status === "APPROVED" ? "badge-good" : "badge-warn"}`}>
              {allocation.status === "APPROVED" ? `Approved ${formatDate(allocation.decidedAt)}` : "Waiting for your approval"}
            </span>
          )}
        </div>
        {allocation ? (
          <>
            <p style={{ marginTop: 12 }}>{allocation.summary}</p>
            <table className="simple">
              <thead><tr><th>Channel</th><th>Share</th><th>Per month</th><th>Why</th></tr></thead>
              <tbody>
                {splits.map((s) => (
                  <tr key={s.provider}>
                    <td><strong>{CHANNELS[s.provider].name}</strong><div className="small muted">{s.expectedResult}</div></td>
                    <td>{s.percent}%</td>
                    <td>{usd(s.cents)}</td>
                    <td className="small">{s.reason}{!CHANNELS[s.provider].autoAds && <div className="muted">{CHANNELS[s.provider].manualNote}.</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 16 }}>
              {allocation.status === "PROPOSED" ? <DecideSplit id={allocation.id} /> : (
                <details>
                  <summary className="small">Ask for a new split</summary>
                  <div style={{ marginTop: 12 }}><RequestSplit label="Propose a new split" /></div>
                </details>
              )}
            </div>
          </>
        ) : business.monthlyBudget > 0 ? (
          <div style={{ marginTop: 12 }}>
            <p className="muted">We&apos;ll look at your goals, audience, plan and any ad results so far, and propose how to split {usd(business.monthlyBudget * 100)} a month, with the reason for each channel.</p>
            <RequestSplit label="Propose my budget split" />
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>Set a monthly ad budget above to get a recommended split.</p>
        )}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Results, last 30 days</h2>
          {perf.length ? (
            <table className="simple">
              <thead><tr><th>Channel</th><th>Spend</th><th>Clicks</th><th>Results</th><th>Cost / result</th></tr></thead>
              <tbody>
                {perf.map((p) => {
                  const cpr = p.conversions > 0 ? p.spendCents / p.conversions : null;
                  return (
                    <tr key={p.provider}>
                      <td>{CHANNELS[p.provider].name}</td>
                      <td>{usd(p.spendCents)}</td>
                      <td>{p.clicks.toLocaleString()}</td>
                      <td>{Math.round(p.conversions).toLocaleString()}</td>
                      <td>{cpr ? usd(cpr) : costPerResult(p) ? "est. " + usd(costPerResult(p)!) : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="muted">Results appear here once your ads are running. Future budget splits move money toward what works.</p>
          )}
        </div>
        {wallet && (
          <div className="card">
            <h2>Wallet history</h2>
            {entries.length ? (
              <table className="simple">
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="small">{formatDate(e.createdAt)}</td>
                      <td className="small">{e.note}</td>
                      <td style={{ textAlign: "right", color: e.amountCents < 0 ? "var(--bad)" : "var(--good)" }}>
                        {e.amountCents < 0 ? "−" : "+"}{usd(Math.abs(e.amountCents))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No wallet activity yet.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
