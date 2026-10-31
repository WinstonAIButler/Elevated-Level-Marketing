import Link from "next/link";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { AUDIT_CATEGORIES, type AuditCategory, type AuditCheck, topFixes } from "@/lib/site-audit";
import { BandBadge, ScoreBar, ScoreRing } from "@/components/Score";
import { AuditButton } from "./AuditButton";

export const metadata = { title: "Website & AI visibility" };

export default async function WebsitePage() {
  const { business } = await requireBusiness();
  const audits = await db.websiteAudit.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const latest = audits[0];
  const checks = (latest?.checks ?? []) as AuditCheck[];
  const fixes = topFixes(checks);
  const categories = (Object.keys(AUDIT_CATEGORIES) as AuditCategory[]).map((id) => {
    const inCat = checks.filter((c) => c.category === id);
    const total = inCat.reduce((s, c) => s + c.weight, 0);
    const earned = inCat.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
    return { id, label: AUDIT_CATEGORIES[id], score: total ? Math.round((earned / total) * 100) : 0, checks: inCat };
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Website &amp; AI visibility</h1>
          <p className="muted">
            How well search engines and AI assistants like ChatGPT, Claude and Perplexity can find and understand your website.
            Autopilot re-checks it every week.
          </p>
        </div>
        {business.website && <AuditButton label={latest ? "Re-check now" : "Audit my website"} />}
      </div>

      {!business.website ? (
        <div className="card" style={{ maxWidth: 640 }}>
          <h2>Add your website</h2>
          <p className="muted">We need your website address to audit it.</p>
          <Link href="/dashboard/business" className="btn btn-primary">Add it to your business profile</Link>
        </div>
      ) : !latest ? (
        <div className="card" style={{ maxWidth: 640 }}>
          <h2>No audit yet</h2>
          <p className="muted">
            We&apos;ll check <strong translate="no">{business.website}</strong> against 19 search and AI-visibility signals and
            tell you exactly what to fix. It takes about 15 seconds.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-2" style={{ marginBottom: 20 }}>
            <div className="card row" style={{ gap: 24 }}>
              <ScoreRing score={latest.score} />
              <div style={{ minWidth: 0 }}>
                <BandBadge score={latest.score} />
                <p className="small muted" style={{ margin: "8px 0 0", overflowWrap: "anywhere" }}>
                  <span translate="no">{latest.url}</span>
                  <br />
                  Checked {formatDate(latest.createdAt)}
                </p>
              </div>
            </div>
            <div className="card">
              <h2>By area</h2>
              {categories.map((c) => (
                <div key={c.id} style={{ marginBottom: 10 }}>
                  <div className="row between small"><span>{c.label}</span><span className="num">{c.score}</span></div>
                  <ScoreBar score={c.score} />
                </div>
              ))}
            </div>
          </div>

          {fixes.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h2>Fix these first</h2>
              <ol className="fix-list">
                {fixes.map((c) => (
                  <li key={c.id}>
                    <strong>{c.label}</strong>
                    <span className="muted small"> {c.detail}</span>
                    <p style={{ margin: "4px 0 0" }}>{c.fix}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="card" style={{ marginBottom: 20 }}>
            <h2>All checks</h2>
            <table className="simple">
              <thead><tr><th scope="col">Check</th><th scope="col">Result</th><th scope="col">Details</th></tr></thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.id}>
                    <td>{c.label}</td>
                    <td><span className={`badge ${c.passed ? "badge-good" : "badge-bad"}`}>{c.passed ? "Pass" : "Fix"}</span></td>
                    <td className="small muted">{c.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {audits.length > 1 && (
            <div className="card">
              <h2>History</h2>
              <ul className="feed">
                {audits.map((a) => (
                  <li key={a.id} className="row between">
                    <span>{formatDate(a.createdAt)}</span>
                    <span className="num">{a.score}/100</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
}
