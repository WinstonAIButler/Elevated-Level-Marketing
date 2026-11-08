import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { CATEGORIES, type CategoryId, type CategoryScores } from "@/lib/assessment";
import type { AssessmentInsight } from "@/lib/ai";
import { AssessmentOverview } from "@/components/AssessmentOverview";

export const metadata = { title: "Assessment report" };

const PRIORITY_BADGE = { high: "badge-bad", medium: "badge-warn", low: "" } as const;

export default async function AssessmentReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusiness();
  const a = await db.assessment.findFirst({ where: { id, businessId: business.id } });
  if (!a) notFound();

  const scores = a.scores as CategoryScores;
  const recs = a.recommendations as AssessmentInsight["recommendations"];
  const previous = await db.assessment.findFirst({
    where: { businessId: business.id, createdAt: { lt: a.createdAt } },
    orderBy: { createdAt: "desc" },
    select: { overallScore: true },
  });
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

      <AssessmentOverview score={a.overallScore} previousScore={previous?.overallScore ?? null} scores={scores} recommendations={recs} summary={a.summary} />

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2 className="area-title good">Strengths</h2>
          <ul>{(a.strengths as string[]).map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
        <div className="card">
          <h2 className="area-title bad">Biggest gaps</h2>
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
