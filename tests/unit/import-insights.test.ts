import { describe, expect, it } from "vitest";
import { importInsights } from "@/lib/statement/insights";
import { investedAfterWithdrawal, isBigDrop } from "@/lib/withdrawal";

const c = (name: string, before: number | null, after: number, extra = {}) => ({
  name, before, after, sipBefore: null, sipAfter: null, withdrew: false, unlinked: false, ...extra,
});

describe("withdrawals", () => {
  it("asks only about big drops, and scales the amount invested down", () => {
    expect(isBigDrop(100000, 95000)).toBe(false);
    expect(isBigDrop(227259, 138000)).toBe(true);
    expect(investedAfterWithdrawal(200000, 227259, 138000)).toBe(121447);
  });
});

describe("import insights", () => {
  it("separates money taken out from growth", () => {
    const out = importInsights([
      c("Liquid fund", 227000, 138000, { withdrew: true }),
      c("Index fund", 100000, 110000),
    ]);
    expect(out[0].title).toBe("Up ₹10,000 since your last update");
    expect(out[0].text).toMatch(/after taking out about ₹89,000/);
    expect(out[1].title).toBe("About ₹89,000 taken out");
    expect(out.find((i) => i.title.startsWith("Best"))?.text).toMatch(/\+10\.0%/);
  });

  it("flags a real fall and new funds without a goal", () => {
    const out = importInsights([
      c("Midcap", 50000, 45000),
      c("New fund", null, 20000, { unlinked: true }),
    ]);
    expect(out.map((i) => i.title)).toContain("Fell most: Midcap");
    expect(out.at(-1)?.text).toMatch(/New fund isn't linked to a goal/);
  });
});
