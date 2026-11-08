import { ScoreMeter } from "./ScoreMeter";
import { CATEGORIES, type CategoryId, type CategoryScores } from "@/lib/assessment";
import type { AssessmentInsight } from "@/lib/ai";

/** An area at or above this is "doing well"; anything lower is shown as needing help. */
const GOOD_AT = 75;

type Rec = AssessmentInsight["recommendations"][number];

export function AssessmentOverview({
  score,
  previousScore,
  scores,
  recommendations,
  summary,
}: {
  score: number;
  previousScore?: number | null;
  scores: CategoryScores;
  recommendations: Rec[];
  summary?: string | null;
}) {
  const ids = (Object.keys(CATEGORIES) as CategoryId[]).sort((a, b) => scores[a] - scores[b]);
  const needsHelp = ids.filter((c) => scores[c] < GOOD_AT);
  const good = ids.filter((c) => scores[c] >= GOOD_AT).reverse();
  const recFor = (c: CategoryId) => recommendations.find((r) => r.category === c);

  return (
    <>
      <div className="card meter-card" style={{ marginBottom: 20 }}>
        <h2>Marketing Score Overview</h2>
        <ScoreMeter score={score} change={previousScore == null ? null : score - previousScore} />
        <p className="muted small" style={{ margin: 0 }}>
          {needsHelp.length} of {ids.length} areas need help · {good.length} doing well
          {previousScore != null && ` · was ${previousScore} last time`}
        </p>
        {summary && <p style={{ margin: "12px auto 0", maxWidth: 640 }}>{summary}</p>}
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20, alignItems: "start" }}>
        <div className="card">
          <h2 className="area-title bad">Areas that need help</h2>
          {needsHelp.length === 0 ? (
            <p className="muted">Nothing below {GOOD_AT}. Every area is in good shape.</p>
          ) : (
            <div className="stack">
              {needsHelp.map((c) => {
                const rec = recFor(c);
                return (
                  <div key={c} className="area-row">
                    <div className="row between">
                      <h3 className="area-name bad">{CATEGORIES[c]}</h3>
                      <span className="badge badge-bad">{scores[c]}/100</span>
                    </div>
                    <div className="bar bad"><span style={{ width: `${Math.max(scores[c], 3)}%` }} /></div>
                    {rec && <p className="muted small" style={{ margin: "6px 0 0" }}><strong>Fix:</strong> {rec.title}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="area-title good">Areas that are good</h2>
          {good.length === 0 ? (
            <p className="muted">No area is at {GOOD_AT} yet. Your plan starts with the weakest ones.</p>
          ) : (
            <div className="stack">
              {good.map((c) => (
                <div key={c} className="area-row">
                  <div className="row between">
                    <h3 className="area-name good">{CATEGORIES[c]}</h3>
                    <span className="badge badge-good">{scores[c]}/100</span>
                  </div>
                  <div className="bar"><span style={{ width: `${scores[c]}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
