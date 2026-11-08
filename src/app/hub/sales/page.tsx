import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { overallScore } from "@/lib/visibility";
import { AssessForm } from "./Forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales · Owners Hub" };

export default async function SalesPage() {
  const leads = await db.visibilityCheck.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const signedUp = leads.filter((l) => l.businessId).length;
  const withEmail = leads.filter((l) => l.email).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sales</h1>
          <p className="muted">Prospects who ran the free visibility check, and any you assess yourself. Open one for its sales brief.</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card"><div className="muted small">Leads</div><div className="stat">{leads.length}</div></div>
        <div className="card"><div className="muted small">Left an email</div><div className="stat">{withEmail}</div></div>
        <div className="card"><div className="muted small">Signed up</div><div className="stat">{signedUp}</div></div>
        <div className="card"><div className="muted small">Check → sign-up</div><div className="stat">{leads.length ? Math.round((signedUp / leads.length) * 100) : 0}%</div></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Assess a prospect</h2>
        <p className="muted small">For a business you&apos;re talking to. Runs the website scan and AI search test, then writes a sales brief with a 30/60/90-day plan.</p>
        <AssessForm />
      </div>

      <div className="card">
        <h2>Leads</h2>
        {leads.length ? (
          <table className="simple">
            <thead><tr><th>Business</th><th>Visibility</th><th>Contact</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {leads.map((l) => {
                const score = overallScore(l.siteScore, l.aiScore);
                return (
                  <tr key={l.id}>
                    <td><strong>{l.businessName}</strong><div className="small muted">{l.industry} · {l.city} · {l.domain}</div></td>
                    <td className="small">
                      {score != null ? <span className={`badge ${score >= 70 ? "badge-good" : score >= 40 ? "badge-warn" : "badge-bad"}`}>{score}/100</span> : "–"}
                      <div className="muted">site {l.siteScore ?? "–"} · AI {l.aiScore ?? "–"}</div>
                    </td>
                    <td className="small">{l.email ?? <span className="muted">no email</span>}<div className="muted">{formatDate(l.createdAt)} · {l.source === "owner" ? "you assessed" : "ran it themselves"}</div></td>
                    <td className="small">
                      {l.businessId ? <span className="badge badge-good">Signed up</span> : <span className="badge badge-dark">Prospect</span>}
                      {l.salesBrief ? <div className="muted">brief ready</div> : null}
                    </td>
                    <td><Link href={`/hub/sales/${l.id}`} className="btn btn-ghost btn-sm">Open</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted">No leads yet. Share <a href="/check">elevatedlevel.app/check</a>, or assess a prospect above.</p>
        )}
      </div>
    </>
  );
}
