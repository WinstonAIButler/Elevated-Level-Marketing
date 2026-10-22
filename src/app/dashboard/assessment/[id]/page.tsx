import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { CATEGORIES, type CategoryId, type CategoryScores } from "@/lib/assessment";
import type { AssessmentInsight } from "@/lib/ai";
import { BandBadge, ScoreBar, ScoreRing } from "@/components/Score";

export const metadata = { title: "Assessment report" };

const PRIORITY_BADGE = { high: "badge-bad", medium: "badge-warn", low: "" } as const;

export default async function AssessmentReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusiness();
  const a = await db.assessment.findFirst({ where: { id, businessId: business.id } });
  if (!a) notFound();

  const scores = a.scores as CategoryScores;
  const recs = a.recommendations as AssessmentInsight["recommendations"];
  const hasPlan = await db.marketingPlan.count({ where: { businessId: business.id, active: true } });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assessment report</h1>
          <p className="muted">{business.name} · {formatDate(a.createdAt)}{a.aiGenerated ? " · AI analysis" : ""}</p>
        </div>
        <Link href="/dashboard/plan" className="btn btn-primary">{hasPlan ? "View marketing plan" : "Build my marketing plan"} →</Link>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card row" style={{ gap: 24, alignItems: "flex-start", flexWrap: "nowrap" }}>
          <ScoreRing score={a.overallScore} />
          <div>
            <h2>Overall score <BandBadge score={a.overallScore} /></h2>
            <p style={{ margin: 0 }}>{a.summary}</p>
          </div>
        </div>
        <div className="card">
          <h2>Scores by area</h2>
          <div className="stack">
            {(Object.keys(CATEGORIES) as CategoryId[]).map((c) => (
              <div key={c}>
                <div className="row between small"><span>{CATEGORIES[c]}</span><strong>{scores[c]}</strong></div>
                <ScoreBar score={scores[c]} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2>Strengths</h2>
          <ul>{(a.strengths as string[]).map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
        <div className="card">
          <h2>Biggest gaps</h2>
          <ul>{(a.weaknesses as string[]).map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      </div>

      <div className="card">
        <h2>Recommendations</h2>
        <div className="stack">
          {recs.map((r) => (
            <div key={r.title} style={{ borderLeft: "3px solid var(--green)", paddingLeft: 14 }}>
              <div className="row">
                <strong>{r.title}</strong>
                <span className={`badge ${PRIORITY_BADGE[r.priority]}`}>{r.priority}</span>
                <span className="muted small">{CATEGORIES[r.category]}</span>
              </div>
              <p className="muted" style={{ margin: "4px 0 0" }}>{r.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
