import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { businessResults } from "@/lib/leads";
import { CHANNEL_LABELS, type Channel } from "@/lib/leads-core";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Results" };

const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

function Compare({ label, before, now, suffix = "", better = "up" }: { label: string; before: number | null; now: number | null; suffix?: string; better?: "up" | "down" }) {
  const delta = before != null && now != null ? now - before : null;
  const good = delta == null || delta === 0 ? null : better === "up" ? delta > 0 : delta < 0;
  return (
    <div className="card">
      <div className="muted small">{label}</div>
      <div className="row" style={{ alignItems: "baseline", gap: 10, marginTop: 6 }}>
        <span className="stat">{now ?? "–"}{now != null ? suffix : ""}</span>
        {delta != null && delta !== 0 && (
          <span className={`badge ${good ? "badge-good" : "badge-bad"}`}>{delta > 0 ? "+" : ""}{Math.round(delta * 10) / 10}{suffix}</span>
        )}
      </div>
      <div className="small muted">Before Elevated: {before ?? "no data"}{before != null ? suffix : ""}</div>
    </div>
  );
}

export default async function ResultsPage() {
  const { user, business } = await requireBusiness();
  const r = await businessResults({ ...business, user });
  const maxLeads = Math.max(1, ...r.bySource.map((s) => s.leads));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Results</h1>
          <p className="muted">What&apos;s changed since you started with Elevated on {formatDate(r.startedAt)}, about {r.weeksSince} weeks ago.</p>
        </div>
        <Link href="/dashboard/leads" className="btn btn-ghost">Manage leads</Link>
      </div>

      {!r.hasBaseline && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          We don&apos;t have your “before” numbers yet. <Link href="/dashboard/leads/connect">Connect your CRM and website form</Link> so we can show how much has changed.
        </div>
      )}

      <h2>Getting found</h2>
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <Compare label="Website & AI readiness score" before={r.websiteScoreBefore} now={r.websiteScoreNow} suffix="/100" />
        <div className="card">
          <div className="muted small">AI search visibility</div>
          <div className="stat">{r.aiScoreBefore ?? "–"}{r.aiScoreBefore != null ? "/100" : ""}</div>
          <div className="small muted">From your first visibility check. <Link href="/check">Run a new check</Link> to compare.</div>
        </div>
        <div className="card">
          <div className="muted small">Leads from Elevated&apos;s work</div>
          <div className="stat">{r.elevatedLeads}</div>
          <div className="small muted">Tracked from our posts, ads and your website form</div>
        </div>
      </div>

      <h2>Getting leads and customers</h2>
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <Compare label="Leads per week" before={r.hasBaseline ? r.leadsPerWeekBefore : null} now={r.leadsPerWeekAfter} />
        <div className="card"><div className="muted small">Leads since you started</div><div className="stat">{r.leadsSince}</div>{r.leadChangePct != null && <div className={`small ${r.leadChangePct >= 0 ? "" : "muted"}`}>{r.leadChangePct >= 0 ? "+" : ""}{r.leadChangePct}% per week vs before</div>}</div>
        <div className="card"><div className="muted small">New customers</div><div className="stat">{r.wonSince}</div></div>
        <div className="card"><div className="muted small">Revenue from new customers</div><div className="stat">{usd(r.revenueSinceCents)}</div></div>
      </div>

      <h2>Return on your spend</h2>
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="card"><div className="muted small">Spent with Elevated</div><div className="stat">{usd(r.spendCents)}</div><div className="small muted">Plan {usd(r.planCents)} + ads {usd(r.adCents)}</div></div>
        <div className="card"><div className="muted small">Revenue traced to Elevated</div><div className="stat">{usd(r.elevatedRevenueCents)}</div></div>
        <div className="card">
          <div className="muted small">Return on spend</div>
          <div className="stat" style={{ color: r.roi != null && r.roi >= 1 ? "var(--good)" : undefined }}>{r.roi != null ? `${r.roi.toFixed(1)}×` : "–"}</div>
          <div className="small muted">{r.roi != null ? `Every $1 spent brought back $${r.roi.toFixed(2)} we can trace` : "Shows once there's spend"}</div>
        </div>
        <div className="card"><div className="muted small">Cost per Elevated lead</div><div className="stat">{r.costPerLeadCents != null ? usd(r.costPerLeadCents) : "–"}</div></div>
      </div>

      <div className="card">
        <h2>Where new leads came from</h2>
        {r.bySource.length ? (
          <table className="simple">
            <thead><tr><th>Source</th><th style={{ width: "40%" }}>Leads</th><th>Customers</th><th>Revenue</th></tr></thead>
            <tbody>
              {r.bySource.map((s) => (
                <tr key={s.source}>
                  <td>{CHANNEL_LABELS[s.source as Channel] ?? s.source}</td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <div aria-hidden="true" style={{ height: 10, borderRadius: 5, background: "var(--green)", width: `${Math.max(4, (s.leads / maxLeads) * 100)}%` }} />
                      <span className="small">{s.leads}</span>
                    </div>
                  </td>
                  <td>{s.won}</td>
                  <td>{usd(s.revenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No new leads recorded yet. Add the website form or connect your CRM on <Link href="/dashboard/leads/connect">Connect</Link>.</p>
        )}
        <p className="small muted" style={{ marginTop: 12 }}>
          “Traced to Elevated” counts only leads that came through our tracked links, ads or form, or that you marked as from Elevated, so the return shown is conservative.
          Ad spend counts spend we can see; plan cost is estimated from your current plan.
        </p>
      </div>
    </>
  );
}
