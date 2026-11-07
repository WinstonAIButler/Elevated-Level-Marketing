import { describe, expect, it } from "vitest";
import { margin, monthlyCost, pricingTable, TARGET_MARGIN, walletFeeMargin } from "./pricing-model";
import { PAID_TIERS, TIERS } from "./tiers";

describe("pricing keeps at least a 40% margin", () => {
  for (const t of PAID_TIERS) {
    it(`${t.name} with every allowance used`, () => {
      expect(margin(t)).toBeGreaterThanOrEqual(TARGET_MARGIN);
    });
  }

  it("wallet fees clear 40% after card processing, from a $50 to a $5,000 top-up", () => {
    for (const t of [TIERS.STARTER, TIERS.GROWTH, TIERS.ELITE]) {
      expect(walletFeeMargin(50, t.adFeePercent)).toBeGreaterThanOrEqual(TARGET_MARGIN);
      expect(walletFeeMargin(5_000, t.adFeePercent)).toBeGreaterThanOrEqual(TARGET_MARGIN);
    }
  });

  it("higher plans get a lower ad fee", () => {
    expect(TIERS.STARTER.adFeePercent).toBeGreaterThan(TIERS.GROWTH.adFeePercent);
    expect(TIERS.GROWTH.adFeePercent).toBeGreaterThan(TIERS.ELITE.adFeePercent);
  });

  it("a free trial costs under $20", () => {
    expect(monthlyCost(TIERS.TRIAL).total).toBeLessThan(20);
  });

  it("prints the table", () => {
    const rows = pricingTable().map((r) => ({
      tier: r.tier,
      price: r.price,
      ai: r.ai.toFixed(2),
      images: r.images.toFixed(2),
      stripe: r.stripe.toFixed(2),
      labor: r.labor.toFixed(2),
      cost: r.total.toFixed(2),
      margin: `${(r.margin * 100).toFixed(1)}%`,
      adFee: `${r.adFee}%`,
      fee50: `${(walletFeeMargin(50, r.adFee) * 100).toFixed(1)}%`,
      fee1000: `${(walletFeeMargin(1000, r.adFee) * 100).toFixed(1)}%`,
    }));
    console.table(rows);
    console.log("trial cost", monthlyCost(TIERS.TRIAL).total.toFixed(2));
  });
});
