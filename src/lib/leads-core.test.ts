import { describe, expect, it } from "vitest";
import { guessMapping, isElevatedCampaign, normalizeSource, parseCsv, parseMoneyToCents, parseStatus, resultsSummary, rowsToLeads, tagLink } from "./leads-core";

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

describe("CSV import", () => {
  it("parses quotes, commas and newlines inside fields", () => {
    const rows = parseCsv('Name,Email,Notes\r\n"Doe, Jane",jane@x.com,"line1\nline2"\nBob,"bob@x.com","He said ""hi"""\n');
    expect(rows).toEqual([
      ["Name", "Email", "Notes"],
      ["Doe, Jane", "jane@x.com", "line1\nline2"],
      ["Bob", "bob@x.com", 'He said "hi"'],
    ]);
  });

  it("guesses columns and builds leads", () => {
    const [headers, ...rows] = parseCsv(
      "First Name,Last Name,Email Address,Mobile Phone,Lead Source,Deal Stage,Amount,Created Date\nAna,Ruiz,ANA@X.COM,555-1000,Facebook,Closed Won,\"$1,250.00\",2026-03-02\n,,,,,,,\nBen,,,,Google,Lost,,\n",
    );
    const map = guessMapping(headers);
    expect(map).toMatchObject({ firstName: 0, lastName: 1, email: 2, phone: 3, source: 4, status: 5, value: 6, date: 7 });
    const leads = rowsToLeads(rows, map);
    expect(leads).toHaveLength(2);
    expect(leads[0]).toMatchObject({ name: "Ana Ruiz", email: "ana@x.com", source: "facebook", status: "WON", valueCents: 125_000 });
    expect(leads[0].occurredAt?.getFullYear()).toBe(2026);
    expect(leads[1]).toMatchObject({ name: "Ben", source: "google", status: "LOST" });
  });

  it("reads money and statuses loosely", () => {
    expect(parseMoneyToCents("$2,000")).toBe(200_000);
    expect(parseMoneyToCents("n/a")).toBe(0);
    expect(parseStatus("Paid")).toBe("WON");
    expect(parseStatus("Estimate sent")).toBe("CONTACTED");
    expect(parseStatus("")).toBe("NEW");
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
  });
});
