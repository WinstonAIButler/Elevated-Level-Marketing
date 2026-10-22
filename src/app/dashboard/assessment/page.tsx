import Link from "next/link";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { CATEGORIES, QUESTIONS, type CategoryId } from "@/lib/assessment";
import { BandBadge } from "@/components/Score";
import { AssessmentForm } from "./AssessmentForm";

export const metadata = { title: "Marketing assessment" };

export default async function AssessmentPage() {
  const { business } = await requireBusiness();
  const history = await db.assessment.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, overallScore: true, createdAt: true },
  });

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
          <p className="muted">16 quick questions across 8 areas. Answer honestly; this sets the baseline we measure your growth against.</p>
        </div>
      </div>

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

      <AssessmentForm groups={groups} />
    </>
  );
}
