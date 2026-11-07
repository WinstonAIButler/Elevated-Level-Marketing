import { describe, expect, it } from "vitest";
import { costPerResult, dailyBudgetCents, looksB2B, maxChannels, normalizeSplits, proposeSplit } from "./allocation";

const ALL = ["META", "GOOGLE_ADS", "GOOGLE_BUSINESS", "LINKEDIN", "TIKTOK", "X"] as const;

describe("proposeSplit", () => {
  it("adds up exactly and never funds the free Google Business Profile", () => {
    const splits = proposeSplit({ totalCents: 150_000, candidates: [...ALL], perf: [], b2b: false });
    expect(splits.reduce((a, s) => a + s.percent, 0)).toBe(100);
    expect(splits.reduce((a, s) => a + s.cents, 0)).toBe(150_000);
    expect(splits.find((s) => s.provider === "GOOGLE_BUSINESS")).toBeUndefined();
    expect(splits[0].provider).toBe("GOOGLE_ADS");
    splits.forEach((s) => expect(s.reason.length).toBeGreaterThan(10));
  });

  it("concentrates small budgets on fewer channels", () => {
    const splits = proposeSplit({ totalCents: 30_000, candidates: [...ALL], perf: [], b2b: false });
    expect(splits.length).toBe(2);
    expect(splits.map((s) => s.provider)).toEqual(["GOOGLE_ADS", "META"]);
  });

  it("favours LinkedIn for B2B", () => {
    const splits = proposeSplit({ totalCents: 300_000, candidates: [...ALL], perf: [], b2b: true });
    const li = splits.find((s) => s.provider === "LINKEDIN")!;
    const meta = splits.find((s) => s.provider === "META")!;
    expect(li.cents).toBeGreaterThan(meta.cents);
  });

  it("moves money toward the channel with cheaper results", () => {
    const perf = [
      { provider: "GOOGLE_ADS" as const, spendCents: 50_000, clicks: 400, conversions: 5 }, // $100 each
      { provider: "META" as const, spendCents: 50_000, clicks: 900, conversions: 25 }, // $20 each
    ];
    const splits = proposeSplit({ totalCents: 100_000, candidates: ["META", "GOOGLE_ADS"], perf, b2b: false });
    expect(splits[0].provider).toBe("META");
    expect(splits[0].reason).toMatch(/cheaper/);
  });
});

describe("normalizeSplits", () => {
  it("drops unknown channels, merges duplicates and fixes totals", () => {
    const out = normalizeSplits(
      [
        { provider: "META", percent: 30, reason: "a", expectedResult: "x" },
        { provider: "META", percent: 20, reason: "a", expectedResult: "x" },
        { provider: "GOOGLE_BUSINESS", percent: 25, reason: "free", expectedResult: "x" },
        { provider: "GOOGLE_ADS", percent: 30, reason: "b", expectedResult: "y" },
      ],
      100_000,
      ["META", "GOOGLE_ADS", "GOOGLE_BUSINESS"],
    );
    expect(out.map((s) => s.provider)).toEqual(["META", "GOOGLE_ADS"]);
    expect(out.reduce((a, s) => a + s.percent, 0)).toBe(100);
    expect(out.reduce((a, s) => a + s.cents, 0)).toBe(100_000);
    expect(out[0].percent).toBe(63);
  });
});

describe("helpers", () => {
  it("ignores channels with too little data", () => {
    expect(costPerResult({ provider: "META", spendCents: 1_000, clicks: 50, conversions: 5 })).toBeNull();
    expect(costPerResult({ provider: "META", spendCents: 10_000, clicks: 10, conversions: 4 })).toBe(2_500);
  });
  it("spreads the monthly share over the days left", () => {
    expect(dailyBudgetCents(31_000, new Date(2026, 0, 1))).toBe(1_000);
    expect(dailyBudgetCents(10_000, new Date(2026, 0, 31))).toBe(10_000);
  });
  it("caps channel count by budget", () => {
    expect(maxChannels(0)).toBe(1);
    expect(maxChannels(60_000)).toBe(4);
  });
  it("spots B2B audiences", () => {
    expect(looksB2B("HR managers at mid-size companies")).toBe(true);
    expect(looksB2B("families in Austin")).toBe(false);
  });
});
