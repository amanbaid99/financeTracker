import { describe, expect, it } from "vitest";
import { reconcileFinancialFact, type FinancialFact } from "@/lib/radar/financial-reconciliation";
const base: FinancialFact = { isin: "INE000000001", periodEnd: "2026-03-31", periodKind: "annual", basis: "consolidated", metric: "revenue", dimension: "amount", value: 123, unit: "INR-crore", roundingStep: 1, metadataVerified: true };
describe("explicit source/filing reconciliation", () => {
  it("reconciles lakh and crore observations without changing the security or period", () => {
    const result = reconcileFinancialFact(base, { ...base, value: 12300, unit: "INR-lakh", roundingStep: 1 });
    expect(result.state).toBe("consistent");expect(result.difference).toBe(0);expect(result.valuationReady).toBe(false);
  });
  it("allows only declared rounding, not an arbitrary percentage tolerance", () => {
    expect(reconcileFinancialFact(base, { ...base, value: 123.4, roundingStep: 0.1 }).state).toBe("consistent");
    expect(reconcileFinancialFact(base, { ...base, value: 124, roundingStep: 0.1 }).state).toBe("different");
  });
  it("does not scale EPS by the statement's overall monetary unit", () => {
    const eps = { ...base, metric: "diluted-eps", dimension: "per-share", value: 0.38, unit: "INR/share", roundingStep: 0.01 };
    expect(reconcileFinancialFact(eps, eps).state).toBe("consistent");
    expect(reconcileFinancialFact(eps, { ...eps, unit: "INR-crore" }).state).toBe("unverified");
  });
  it("does not make a false mismatch from binary arithmetic at the declared rounding boundary", () => {
    const eps = { ...base, metric: "diluted-eps", dimension: "per-share", value: 0.38, unit: "INR/share", roundingStep: 0.01 };
    expect(reconcileFinancialFact(eps, { ...eps, value: 0.39 }).state).toBe("consistent");
    expect(reconcileFinancialFact(eps, { ...eps, value: 0.3901 }).state).toBe("different");
    const large = { ...base, value: 9_000_000_000_000_000, unit: "INR", roundingStep: 1 };
    expect(reconcileFinancialFact(large, { ...large, value: large.value - 2 }).state).toBe("different");
  });
  it("never resolves an unspecified EPS definition merely because values are numerically close", () => {
    const reported = { ...base, metric: "reported-eps", dimension: "per-share", value: 0.38, unit: "INR/share", roundingStep: 0.01 };
    expect(reconcileFinancialFact(reported, { ...reported, metric: "diluted-eps", value: 0.39 }).state).toBe("unverified");
  });
  it.each([
    { isin: "INE000000009" }, { periodEnd: "2026-09-30" }, { periodKind: "half-year" },
    { basis: "standalone" }, { metric: "net-profit" }, { dimension: "percentage" },
    { metadataVerified: false }, { unit: "unknown" }, { roundingStep: 0 }, { value: Infinity },
  ])("does not compare incompatible or unverified facts: %j", (change) => {
    expect(reconcileFinancialFact(base, { ...base, ...change }).state).toBe("unverified");
  });
  it("preserves negative financial values and rejects overflow", () => {
    expect(reconcileFinancialFact({ ...base, value: -10 }, { ...base, value: -1000, unit: "INR-lakh" }).state).toBe("consistent");
    expect(reconcileFinancialFact({ ...base, value: Number.MAX_VALUE }, base).state).toBe("unverified");
  });
});
