import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/engine";
import { assertAnonymous, buildFacts, roughRupees } from "@/lib/ai/facts";
import { cleanOutput, findNamedProducts } from "@/lib/ai/guard";
import { solidBasics, profile, TODAY } from "../engine/fixtures";

const data = solidBasics({
  profile: profile({ name: "Aarav Sharma", age: 31 }),
  expenses: [{ id: "e", category: "Rent", amountMonthly: 120_000, isEssential: true }],
  liabilities: [{ id: "l", kind: "credit_card", label: "My Platinum Card", outstanding: 40_000, interestRate: 40, emi: 5_000 }],
  holdings: [{ id: "h", kind: "mutual_fund", name: "Acme Bluechip Fund", category: "large_cap", currentValue: 90_000, monthlySip: 5_000 }],
  goals: [{ id: "g", name: "Goa trip with Priya", type: "travel", targetToday: 150_000, targetDate: "2027-12-01", priority: 1, inflationRate: null, savedAmount: 0 }],
});
const analysis = analyze(data, {}, TODAY);

describe("AI facts are anonymous", () => {
  for (const feature of ["next_focus", "goal", "plan_review"] as const) {
    it(`${feature} payload has no personal text`, () => {
      const payload = JSON.stringify(buildFacts(analysis, feature, "g"));
      for (const s of ["Aarav", "Sharma", "Platinum", "Acme", "Bluechip", "Priya", "Goa", "31"]) {
        expect(payload).not.toContain(s);
      }
      expect(() => assertAnonymous(payload, ["Aarav Sharma", "My Platinum Card", "Acme Bluechip Fund"])).not.toThrow();
    });
  }

  it("rounds money to 2 significant figures", () => {
    expect(roughRupees(123_456)).toBe("₹1.2 lakh");
    expect(roughRupees(17_834_000)).toBe("₹1.8 crore");
    expect(roughRupees(4_567)).toBe("₹4,600");
  });

  it("blocks emails, PAN, phone numbers and personal strings", () => {
    expect(() => assertAnonymous('{"a":"me@x.com"}', [])).toThrow();
    expect(() => assertAnonymous('{"a":"ABCDE1234F"}', [])).toThrow();
    expect(() => assertAnonymous('{"a":"9876543210"}', [])).toThrow();
    expect(() => assertAnonymous('{"a":"for aarav"}', ["Aarav"])).toThrow();
  });
});

describe("AI output guard", () => {
  it("flags named products but allows category phrases", () => {
    expect(findNamedProducts("Consider an Equity Index Fund or a Liquid Fund.")).toEqual([]);
    expect(findNamedProducts("Put it in Acme Bluechip Fund.")).toEqual(["Acme Bluechip Fund"]);
    expect(findNamedProducts("Zeta Mutual Fund has good returns")).toHaveLength(1);
  });

  it("removes em dashes", () => {
    expect(cleanOutput("Save first — then invest")).toBe("Save first, then invest");
  });
});
