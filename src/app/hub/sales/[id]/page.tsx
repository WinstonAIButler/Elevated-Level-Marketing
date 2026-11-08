import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { TIERS } from "@/lib/tiers";
import { displayPrices } from "@/lib/stripe-prices";
import { checkSummary, overallScore } from "@/lib/visibility";
import { SITE_URL } from "@/lib/site";
import type { SalesBriefOutput } from "@/lib/ai";
import { ScoreRing } from "@/components/Score";
import { CopyButton } from "@/components/CopyButton";
import { NotesForm, RefreshBrief } from "../Forms";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata = { title: "Sales brief · Owners Hub" };

function Phase({ title, p }: { title: string; p: SalesBriefOutput["day30"] }) {
  return (
    <div className="card">
      <div className="muted small">{title}</div>
      <h3 style={{ marginTop: 4 }}>{p.focus}</h3>
      <strong className="small">What we do</strong>
      <ul className="small" style={{ marginTop: 4 }}>{p.actions.map((a) => <li key={a}>{a}</li>)}</ul>
      <strong className="small">Targets</strong>
      <ul className="small" style={{ marginTop: 4 }}>{p.targets.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  );
}

export default async function LeadBrief({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await db.visibilityCheck.findUnique({ where: { id } });
  if (!lead) notFound();
  const { fixes, ai } = checkSummary(lead);
  const brief = lead.salesBrief as SalesBriefOutput | null;
  const prices = await displayPrices();
  const overall = overallScore(lead.siteScore, lead.aiScore);
  const reportUrl = `${SITE_URL}/check/${lead.id}`;
  const signupUrl = `${SITE_URL}/signup?check=${lead.id}`;

  return (
    <>
      <Link href="/hub/sales" className="small muted">← All leads</Link>
      <div className="page-head" style={{ marginTop: 6 }}>
        <div>
          <h1>{lead.businessName}</h1>
          <p className="muted">{lead.industry} · {lead.city} · <a href={lead.url} target="_blank" rel="noreferrer">{lead.domain}</a> · {lead.email ?? "no email"} · checked {formatDate(lead.createdAt)}</p>
        </div>
        {overall != null && <div style={{ textAlign: "center" }}><ScoreRing score={overall} size={96} /><div className="small muted">site {lead.siteScore ?? "–"} · AI {lead.aiScore ?? "–"}</div></div>}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row between">
          <h2 style={{ margin: 0 }}>Share with the prospect</h2>
          {lead.businessId ? <span className="badge badge-good">Signed up</span> : <span className="badge badge-dark">Prospect</span>}
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Their report (no sign-in needed), and a sign-up link that carries the report into their account.</p>
        <div className="copy-block"><CopyButton text={reportUrl} />{reportUrl}</div>
        <div className="copy-block" style={{ marginTop: 8 }}><CopyButton text={signupUrl} />{signupUrl}</div>
      </div>

      {!brief ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>Sales brief</h2>
          <p className="muted">Claude reads their results and writes what to say: weaknesses, needs, the right plan, and a 30/60/90-day plan.</p>
          <RefreshBrief id={lead.id} has={false} />
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="row between">
              <h2 style={{ margin: 0 }}>Sales brief</h2>
              <RefreshBrief id={lead.id} has />
            </div>
            <p style={{ fontSize: "1.15rem", marginTop: 12 }}>{brief.headline}</p>
            <div className="grid grid-2">
              <div>
                <strong>Where they&apos;re weak</strong>
                <ul className="plain-list" style={{ marginTop: 6 }}>
                  {brief.weaknesses.map((w) => (
                    <li key={w.area} style={{ marginBottom: 8 }}><strong>{w.area}:</strong> {w.finding}<div className="small muted">{w.impact}</div></li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Needs to confirm on the call</strong>
                <ul style={{ marginTop: 6 }}>{brief.needs.map((n) => <li key={n}>{n}</li>)}</ul>
                <div className="card card-flat" style={{ marginTop: 12 }}>
                  <div className="muted small">Recommended plan</div>
                  <div className="stat" style={{ fontSize: "1.4rem" }}>{TIERS[brief.recommendedTier].name} · ${prices[brief.recommendedTier]}/mo</div>
                  <p className="small" style={{ margin: "6px 0" }}>{brief.tierReason}</p>
                  <p className="small muted" style={{ margin: 0 }}>
                    Suggested ad budget: {brief.suggestedMonthlyAdBudget ? `$${brief.suggestedMonthlyAdBudget.toLocaleString()}/mo + ${TIERS[brief.recommendedTier].adFeePercent}% management fee` : "hold off on ads for now"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <h2>What Elevated would do</h2>
          <div className="grid grid-3" style={{ marginBottom: 20 }}>
            <Phase title="First 30 days" p={brief.day30} />
            <Phase title="Days 31–60" p={brief.day60} />
            <Phase title="Days 61–90" p={brief.day90} />
          </div>
          <p className="small muted" style={{ marginTop: -8, marginBottom: 20 }}>Targets are goals to work toward, not promises. Results depend on budget, market and how fast the client approves content.</p>

          <div className="grid grid-2" style={{ marginBottom: 20 }}>
            <div className="card"><h2>Talking points</h2><ul>{brief.talkingPoints.map((t) => <li key={t} style={{ marginBottom: 6 }}>{t}</li>)}</ul></div>
            <div className="card">
              <h2>Objections</h2>
              {brief.objections.map((o) => (
                <div key={o.objection} style={{ marginBottom: 10 }}><strong>&ldquo;{o.objection}&rdquo;</strong><div className="small">{o.response}</div></div>
              ))}
            </div>
          </div>
          {lead.salesBriefAt && <p className="small muted">Brief written {formatDate(lead.salesBriefAt)}.</p>}
        </>
      )}

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2>Their results</h2>
          {ai ? (
            <table className="simple">
              <tbody>
                {ai.queries.map((q) => (
                  <tr key={q.query}>
                    <td className="small">&ldquo;{q.query}&rdquo;<div className="muted">{q.recommended.slice(0, 4).join(", ")}</div></td>
                    <td>{q.mentioned ? <span className="badge badge-good">#{q.rank ?? "–"}</span> : <span className="badge badge-bad">Not shown</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted small">No AI search results.</p>}
          {fixes.length > 0 && (
            <>
              <strong className="small" style={{ display: "block", marginTop: 12 }}>Top website fixes</strong>
              <ul className="small">{fixes.map((f) => <li key={f.id}>{f.label}</li>)}</ul>
            </>
          )}
        </div>
        <div className="card">
          <h2>Your notes</h2>
          <NotesForm id={lead.id} notes={lead.salesNotes ?? ""} />
        </div>
      </div>
    </>
  );
}
