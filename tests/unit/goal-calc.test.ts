import { describe, expect, it } from "vitest";
import {
  costNumber,
  emergencyNumber,
  houseNumber,
  parseEstimate,
  retirementNumber,
  suggestedMonths,
} from "@/lib/goal-calc";

const TODAY = "2026-11-06";

describe("retirement number", () => {
  it("grows today's spending to retirement and makes it last", () => {
    const r = retirementNumber({
      age: 30, retireAge: 60, lifeTo: 85, monthlyExpenses: 50000,
      inflationPct: 6, returnAfterPct: 7, todayISO: TODAY,
    });
    // ₹6L a year today is about ₹34.5L a year at 60 (6% for 30 years).
    // Real return ≈ 0.94%, 25 years drawn at the start of each year: ≈ 22.6 years of spending.
    expect(r.headline.amount).toBeGreaterThan(7.5e7);
    expect(r.headline.amount).toBeLessThan(8.2e7);
    expect(r.target).toBeGreaterThan(1.3e7); // in today's money
    expect(r.target).toBeLessThan(1.5e7);
    expect(r.targetDate).toBe("2056-11-06");
    expect(r.inflationPct).toBe(6);
  });

  it("needs exactly the years of spending when returns only match prices", () => {
    const r = retirementNumber({
      age: 60, retireAge: 60, lifeTo: 80, monthlyExpenses: 10000,
      inflationPct: 6, returnAfterPct: 6, todayISO: TODAY,
    });
    expect(r.target).toBe(2400000);
  });
});

describe("other goals", () => {
  it("emergency fund: months of essentials, more when others depend on you", () => {
    expect(emergencyNumber({ monthly: 55000, months: 6 }).target).toBe(330000);
    expect(suggestedMonths({ dependents: 2, soleEarner: true }).months).toBe(9);
    expect(suggestedMonths({ dependents: 0, soleEarner: false }).months).toBe(6);
  });

  it("house: down payment plus buying costs, in today's money", () => {
    const h = houseNumber({ price: 8000000, downPct: 20, extrasPct: 7, years: 5, inflationPct: 6, todayISO: TODAY });
    expect(h.target).toBe(2160000);
    expect(h.headline.amount).toBe(2890000);
  });

  it("anything else: today's cost grown with prices", () => {
    expect(costNumber({ cost: 1500000, years: 2, inflationPct: 10, todayISO: TODAY, what: "An MBA" }).headline.amount).toBe(1820000);
  });
});

describe("AI cost estimates", () => {
  it("accepts a sensible range and rejects nonsense", () => {
    expect(parseEstimate('{"low":800000,"typical":1200000,"high":2000000,"assumptions":["300 guests"]}')).toEqual({
      low: 800000, typical: 1200000, high: 2000000, assumptions: ["300 guests"],
    });
    expect(parseEstimate('{"low":0,"typical":0,"high":0,"assumptions":["not enough to go on"]}')).toBeNull();
    expect(parseEstimate('{"low":900000,"typical":500000,"high":2000000}')).toBeNull();
    expect(parseEstimate("not json")).toBeNull();
  });
});
