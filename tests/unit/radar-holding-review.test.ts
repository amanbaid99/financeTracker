import { describe, expect, it } from "vitest";
import { holdingReviewInputSchema, holdingReviewSchema, positionContext } from "@/lib/radar/holding-review";
const isin = "INE000000001";
const input = { ownershipConfirmed: true, contextConfirmed: true, costsReviewed: true, targetSharePct: 10, rebalanceBandPct: 2, thesis: "intact", estimatedExitCostPct: 1 };
const review = { ...input, isin, reviewedAt: "2026-11-18T05:00:00Z" };
describe("confirmed holding review inputs", () => {
  it("requires explicit confirmations without default allocation or costs", () => {
    expect(holdingReviewInputSchema.safeParse(input).success).toBe(true);
    for (const key of Object.keys(input)) expect(holdingReviewInputSchema.safeParse({ ...input, [key]: undefined }).success).toBe(false);
  });
  it.each([-1, 101, Infinity, NaN, "10"])("rejects invalid percentages %s", (value) => {
    for (const key of ["targetSharePct", "rebalanceBandPct", "estimatedExitCostPct"]) expect(holdingReviewInputSchema.safeParse({ ...input, [key]: value }).success).toBe(false);
  });
  it("rejects client timestamps and unexpected properties", () => {
    expect(holdingReviewInputSchema.safeParse(review).success).toBe(false);
    expect(holdingReviewInputSchema.safeParse({ ...input, recordedSharePct: 10 }).success).toBe(false);
  });
  it("requires valid saved metadata and uses the current matched holding share", () => {
    expect(holdingReviewSchema.safeParse(review).success).toBe(true);
    expect(positionContext(review, isin, { matched: true, recordedValue: 100, trackedSharePct: 23 })?.recordedSharePct).toBe(23);
    expect(positionContext(review, "INE000000002", { matched: true, recordedValue: 100, trackedSharePct: 23 })).toBeUndefined();
  });
  it("does not replace missing or unreliable holding amounts with a reviewed target", () => {
    for (const context of [undefined, { matched: false, recordedValue: null, trackedSharePct: null }, { matched: true, recordedValue: 100, trackedSharePct: null }, { matched: true, recordedValue: 0, trackedSharePct: 0 }]) expect(positionContext(review, isin, context)).toBeUndefined();
    expect(positionContext({ ...review, reviewedAt: "invalid" }, isin, { matched: true, recordedValue: 100, trackedSharePct: 10 })).toBeUndefined();
  });
});
