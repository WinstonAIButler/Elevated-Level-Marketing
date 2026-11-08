import { describe, expect, it } from "vitest";
import { isElevatedCampaign, normalizeSource, parseDate, parseMoneyToCents, parseStatus, resultsSummary, tagLink } from "./leads-core";

describe("normalizeSource", () => {
  it("maps common labels onto channels", () => {
    expect(normalizeSource("Facebook Ads")).toBe("facebook");
    expect(normalizeSource("IG")).toBe("instagram");
    expect(normalizeSource("Google Business Profile")).toBe("google_business");
    expect(normalizeSource("google cpc")).toBe("google_ads");
    expect(normalizeSource("Organic Search")).toBe("google");
    expect(normalizeSource("ChatGPT")).toBe("ai_search");
    expect(normalizeSource("Friend referral")).toBe("referral");
    expect(normalizeSource("", null, "Website form")).toBe("website");
    expect(normalizeSource("walk-in")).toBe("other");
  });
});

describe("tagLink", () => {
  it("adds Elevated tracking parameters", () => {
    const u = new URL(tagLink("https://shop.com/menu", "instagram", "social", "Week 3 content batch")!);
    expect(u.searchParams.get("utm_source")).toBe("instagram");
    expect(u.searchParams.get("utm_medium")).toBe("social");
    expect(u.searchParams.get("utm_campaign")).toBe("elevated-week-3-content-batch");
    expect(isElevatedCampaign(u.searchParams.get("utm_campaign"))).toBe(true);
  });
  it("leaves links that already have tracking, and bad links, alone", () => {
    expect(tagLink("https://a.com/?utm_source=news", "x", "social", "c")).toBe("https://a.com/?utm_source=news");
    expect(tagLink("not a url", "x", "social", "c")).toBe("not a url");
  });
});

describe("parsing CRM values", () => {
  it("reads money and statuses loosely", () => {
    expect(parseMoneyToCents("$2,000")).toBe(200_000);
    expect(parseMoneyToCents("n/a")).toBe(0);
    expect(parseStatus("Paid")).toBe("WON");
    expect(parseStatus("Estimate sent")).toBe("CONTACTED");
    expect(parseStatus("")).toBe("NEW");
    expect(parseDate("2026-03-02")?.getFullYear()).toBe(2026);
    expect(parseDate("not a date")).toBeNull();
  });
});

describe("resultsSummary", () => {
  const started = new Date("2026-06-01T00:00:00Z");
  const now = new Date("2026-07-27T00:00:00Z"); // 8 weeks later
  const lead = (d: string, extra: Partial<{ status: "NEW" | "WON"; valueCents: number; elevated: boolean; source: string }> = {}) => ({
    occurredAt: new Date(d),
    status: extra.status ?? "NEW",
    valueCents: extra.valueCents ?? 0,
    wonAt: null,
    source: extra.source ?? "google",
    elevated: extra.elevated ?? false,
  });

  it("compares before vs since and computes return on spend", () => {
    const leads = [
      ...Array.from({ length: 12 }, (_, i) => lead(`2026-0${i < 6 ? 4 : 5}-1${i % 9}T00:00:00Z`)), // 12 before → 1/week
      ...Array.from({ length: 16 }, () => lead("2026-06-20T00:00:00Z", { elevated: true, source: "instagram" })), // 16 after → 2/week
      lead("2026-07-01T00:00:00Z", { status: "WON", valueCents: 300_000, elevated: true, source: "google_ads" }),
      lead("2026-07-02T00:00:00Z", { status: "WON", valueCents: 100_000 }),
    ];
    const r = resultsSummary(leads, { startedAt: started, now, spendCents: 200_000 });
    expect(r.leadsPerWeekBefore).toBe(1);
    expect(r.leadsPerWeekAfter).toBe(2.3);
    expect(r.leadChangePct).toBe(125);
    expect(r.revenueSinceCents).toBe(400_000);
    expect(r.elevatedRevenueCents).toBe(300_000);
    expect(r.roi).toBe(1.5);
    expect(r.bySource[0].source).toBe("instagram");
  });

  it("handles no baseline and no spend", () => {
    const r = resultsSummary([lead("2026-07-01T00:00:00Z")], { startedAt: started, now, spendCents: 0 });
    expect(r.hasBaseline).toBe(false);
    expect(r.leadChangePct).toBeNull();
    expect(r.roi).toBeNull();
    expect(r.costPerLeadCents).toBeNull();
  });
});
