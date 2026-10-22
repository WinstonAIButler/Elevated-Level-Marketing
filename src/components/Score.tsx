import { scoreBand } from "@/lib/assessment";

const RING = { good: "var(--green-strong)", warn: "#e0a43a", bad: "#e06a5a" };

export function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const band = scoreBand(score);
  return (
    <div
      className="score-ring"
      style={{ "--pct": score, "--size": `${size}px`, "--ring": RING[band.tone] } as React.CSSProperties}
      aria-label={`Score ${score} out of 100`}
    >
      <div>{score}</div>
    </div>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const band = scoreBand(score);
  return (
    <div className={`bar ${band.tone === "good" ? "" : band.tone}`}>
      <span style={{ width: `${Math.max(score, 3)}%` }} />
    </div>
  );
}

export function BandBadge({ score }: { score: number }) {
  const band = scoreBand(score);
  return <span className={`badge badge-${band.tone}`}>{band.label}</span>;
}
