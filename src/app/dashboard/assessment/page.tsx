import Link from "next/link";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { CATEGORIES, QUESTIONS, type CategoryId, type CategoryScores } from "@/lib/assessment";
import type { AssessmentInsight } from "@/lib/ai";
import { BandBadge } from "@/components/Score";
import { AssessmentOverview } from "@/components/AssessmentOverview";
import { AssessmentForm } from "./AssessmentForm";

export const metadata = { title: "Marketing assessment" };

export default async function AssessmentPage() {
  const { business } = await requireBusiness();
  const history = await db.assessment.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, overallScore: true, createdAt: true },
  });
  const latest = history[0]
    ? await db.assessment.findUnique({ where: { id: history[0].id }, select: { id: true, overallScore: true, scores: true, recommendations: true, summary: true } })
    : null;

  const groups = (Object.keys(CATEGORIES) as CategoryId[]).map((id) => ({
    id,
    label: CATEGORIES[id],
    questions: QUESTIONS.filter((q) => q.category === id),
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Marketing assessment</h1>
          <p className="muted">
            {latest
              ? "Where your marketing stands today: red areas need help, green areas are working."
              : "16 quick questions across 8 areas. Answer honestly; this sets the baseline we measure your growth against."}
          </p>
        </div>
        {latest && <Link href={`/dashboard/assessment/${latest.id}`} className="btn">Full report →</Link>}
      </div>

      {latest && (
        <AssessmentOverview
          score={latest.overallScore}
          previousScore={history[1]?.overallScore ?? null}
          scores={latest.scores as CategoryScores}
          recommendations={latest.recommendations as AssessmentInsight["recommendations"]}
        />
      )}

      {history.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>Past assessments</h2>
          <table className="simple">
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{formatDate(h.createdAt)}</td>
                  <td><strong>{h.overallScore}</strong>/100 <BandBadge score={h.overallScore} /></td>
                  <td style={{ textAlign: "right" }}><Link href={`/dashboard/assessment/${h.id}`}>View report</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {latest ? (
        <details className="card">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Retake the assessment</summary>
          <p className="muted small">Answer again after a few weeks to see your score move.</p>
          <AssessmentForm groups={groups} />
        </details>
      ) : (
        <AssessmentForm groups={groups} />
      )}
    </>
  );
}
