import { describe, expect, it } from "vitest";
import { categoryLabel, HOLDING_CATEGORIES, isEquity, isLiquid } from "@/lib/engine/categories";

describe("holding categories", () => {
  it("includes arbitrage funds as a low-risk, non-emergency category", () => {
    expect(categoryLabel("arbitrage")).toBe("Arbitrage fund");
    expect(isLiquid("mutual_fund", "arbitrage")).toBe(false);
    expect(isEquity("mutual_fund", "arbitrage")).toBe(false);
  });

  it("has unique values that fit the database column", () => {
    const values = HOLDING_CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
    for (const v of values) expect(v.length).toBeLessThanOrEqual(40);
  });
});
