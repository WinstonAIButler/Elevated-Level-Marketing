import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { checkSummary, overallScore } from "@/lib/visibility";
import { ScoreRing } from "@/components/Score";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AUDIT_CATEGORIES } from "@/lib/site-audit";

export const metadata: Metadata = { title: "Your Visibility Report", robots: { index: false, follow: false } };

export default async function CheckResult({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await db.visibilityCheck.findUnique({ where: { id } });
  if (!check) notFound();
  const { fixes, ai } = checkSummary(check);
  const overall = overallScore(check.siteScore, check.aiScore);
  const user = await currentUser();
  const mentionedIn = ai ? ai.queries.filter((q) => q.mentioned).length : 0;

  return (
    <>
      <SiteHeader />
      <main id="main" className="section">
        <div className="container" style={{ maxWidth: 960 }}>
          <p className="small muted">Visibility report · {check.domain} · {check.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
          <div className="row between" style={{ alignItems: "center", gap: 24 }}>
            <div style={{ flex: "1 1 420px" }}>
              <h1 style={{ marginBottom: 8 }}>{check.businessName}</h1>
              {ai ? (
                <p style={{ fontSize: "1.15rem" }}>
                  {mentionedIn === 0
                    ? <>When customers in {check.city} ask AI for a {check.industry}, <strong>{check.businessName} didn&apos;t come up in any of {ai.queries.length} searches.</strong></>
                    : <>{check.businessName} came up in <strong>{mentionedIn} of {ai.queries.length}</strong> AI searches customers in {check.city} might run.</>}
                </p>
              ) : (
                <p className="muted">Here&apos;s how your website looks to search engines and AI assistants.</p>
              )}
            </div>
            {overall != null && (
              <div style={{ textAlign: "center" }}>
                <ScoreRing score={overall} />
                <div className="small muted" style={{ marginTop: 6 }}>Overall visibility</div>
              </div>
            )}
          </div>
          {check.error && <div className="alert alert-info" style={{ margin: "16px 0" }}>Part of the check couldn&apos;t run: {check.error}</div>}

          <div className="grid grid-2" style={{ margin: "24px 0" }}>
            <div className="card">
              <div className="row between"><h2 style={{ margin: 0 }}>AI search</h2>{check.aiScore != null && <span className="badge badge-dark">{check.aiScore}/100</span>}</div>
              {ai ? (
                <>
                  <table className="simple" style={{ marginTop: 12 }}>
                    <thead><tr><th>What a customer asks</th><th>You?</th></tr></thead>
                    <tbody>
                      {ai.queries.map((q) => (
                        <tr key={q.query}>
                          <td>
                            &ldquo;{q.query}&rdquo;
                            {q.recommended.length > 0 && <div className="small muted">Recommended: {q.recommended.slice(0, 4).join(", ")}</div>}
                          </td>
                          <td>{q.mentioned ? <span className="badge badge-good">#{q.rank ?? "–"}</span> : <span className="badge badge-bad">Not shown</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="small" style={{ marginTop: 12 }}>{ai.summary}</p>
                </>
              ) : (
                <p className="muted">The AI search test isn&apos;t available right now. The website scan below still shows what to fix.</p>
              )}
            </div>
            <div className="card">
              <div className="row between"><h2 style={{ margin: 0 }}>Website</h2>{check.siteScore != null && <span className="badge badge-dark">{check.siteScore}/100</span>}</div>
              {fixes.length ? (
                <ol className="fix-list" style={{ marginTop: 12 }}>
                  {fixes.map((f) => (
                    <li key={f.id}>
                      <strong>{f.label}</strong> <span className="small muted">· {AUDIT_CATEGORIES[f.category]}</span>
                      <div className="small">{f.detail}</div>
                      <div className="small muted">Fix: {f.fix}</div>
                    </li>
                  ))}
                </ol>
              ) : check.siteScore != null ? (
                <p className="muted">Your website passes our checks. Nice work.</p>
              ) : (
                <p className="muted">We couldn&apos;t scan the website.</p>
              )}
            </div>
          </div>

          {ai && (ai.competitors.length > 0 || ai.reasons.length > 0) && (
            <div className="grid grid-2" style={{ marginBottom: 24 }}>
              {ai.competitors.length > 0 && (
                <div className="card">
                  <h2>Who&apos;s showing up instead</h2>
                  <ul className="plain-list">
                    {ai.competitors.slice(0, 5).map((c) => <li key={c.name}><strong>{c.name}</strong><div className="small muted">{c.why}</div></li>)}
                  </ul>
                </div>
              )}
              {ai.reasons.length > 0 && (
                <div className="card">
                  <h2>Why</h2>
                  <ul>{ai.reasons.map((r) => <li key={r} className="small" style={{ marginBottom: 6 }}>{r}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          <div className="card cta-band" style={{ textAlign: "center" }}>
            <h2>Elevated fixes this for you, every week</h2>
            <p className="muted" style={{ maxWidth: 640, margin: "0 auto 16px" }}>
              We write the posts, local updates and website content AI assistants rely on, keep your Google Business Profile
              active, run ads where your customers search, and re-check your visibility every week so you can see it improve.
              You approve everything before it goes out.
            </p>
            {user ? (
              <Link href="/dashboard" className="btn btn-primary btn-lg">Go to your dashboard</Link>
            ) : (
              <Link href={`/signup?check=${check.id}`} className="btn btn-primary btn-lg">Start free and fix this</Link>
            )}
            <p className="small muted" style={{ marginTop: 10 }}>Free trial, no card required. This report is saved to your account.</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
