"use client";
import { useEffect, useState } from "react";
import { scoreBand } from "@/lib/assessment";

const METER = { good: "var(--green-strong)", warn: "#e0a43a", bad: "#e06a5a" };
const DURATION = 1400;

/** Counts from 0 up to `to` with an ease-out, in step with the dial's CSS sweep. */
function useCountUp(to: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(to); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / DURATION, 1);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return n;
}

/** Half-open dial: a 270° arc with the score in the middle, like a speedometer. */
export function ScoreMeter({ score, change }: { score: number; change?: number | null }) {
  const band = scoreBand(score);
  const shown = useCountUp(score);
  const arc = { cx: 100, cy: 100, r: 80, fill: "none", strokeWidth: 16, strokeLinecap: "round" as const, pathLength: 100, transform: "rotate(135 100 100)" };
  return (
    <div className="meter" role="img" aria-label={`Overall score ${score} out of 100, ${band.label}`}>
      <svg viewBox="0 0 200 180" width="230" height="207" aria-hidden="true">
        <circle {...arc} stroke="#e9edf1" strokeDasharray="75 100" />
        <circle {...arc} className="meter-fill" stroke={METER[band.tone]} strokeDasharray={`${Math.max(score, 1) * 0.75} 100`} />
      </svg>
      <div className="meter-value" aria-hidden="true">
        <strong>{shown}</strong>
        <span>{band.label}</span>
      </div>
      {change != null && change !== 0 && (
        <span className={`meter-change ${change > 0 ? "up" : "down"}`} title="Change since your last assessment">
          {change > 0 ? "↑" : "↓"} {Math.abs(change)}
        </span>
      )}
    </div>
  );
}
