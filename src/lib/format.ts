export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Current week of a plan (1-based), clamped to the plan's length. */
export function currentPlanWeek(startDate: Date, durationWeeks: number, now = new Date()) {
  const week = Math.floor((now.getTime() - startDate.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
  return Math.min(Math.max(week, 1), durationWeeks);
}
