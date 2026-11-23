import { describe, expect, it } from "vitest";
import { sipSuggestions } from "@/lib/simple-sip";
import { trackGoal, type GoalInput, type Investment } from "@/lib/tracker";

const today = "2026-11-23";
const inv = (
  id: string,
  kind: string,
  category: string | null,
  value: number,
  monthlySip = 0,
): Investment => ({
  id,
  kind,
  name: id,
  category,
  value,
  monthlySip,
  returnPct: null,
});

describe("sipSuggestions", () => {
  const investments = [
    inv("index", "mutual_fund", "equity_index", 100000, 5000),
    inv("liquid", "mutual_fund", "liquid_fund", 50000),
    inv("bank", "savings", "savings_account", 20000),
    inv("fd", "fd", null, 100000),
  ];
  const goal: GoalInput = {
    id: "house",
    name: "House",
    type: "custom",
    target: 5000000,
    targetDate: "2034-11-23",
    inflationPct: null,
  };

  it("lists every holding you can add monthly money to, even with nothing suggested", () => {
    const s = sipSuggestions({
      goals: [trackGoal(goal, investments, [], today)],
      investments,
      links: [],
      today,
      budgetMonthly: 0,
    });
    expect(s.holdings.map((h) => h.investment.id).sort()).toEqual([
      "bank",
      "index",
      "liquid",
    ]);
    expect(s.holdings.every((h) => h.suggested >= 0)).toBe(true);
    expect(s.goalsNeed).toBeGreaterThan(0);
  });

  it("limits suggestions to the budget's Save & invest when it is smaller", () => {
    const s = sipSuggestions({
      goals: [trackGoal(goal, investments, [], today)],
      investments,
      links: [],
      today,
      budgetMonthly: 1000,
    });
    expect(s.basis).toBe(1000);
    const total =
      s.holdings.reduce((a, h) => a + h.suggested, 0) +
      s.newFunds.reduce((a, f) => a + f.suggested, 0);
    expect(total).toBeLessThanOrEqual(Math.max(1000, 5000));
  });

  it("shows everything at zero when there are no goals", () => {
    const s = sipSuggestions({
      goals: [],
      investments,
      links: [],
      today,
      budgetMonthly: 50000,
    });
    expect(s.holdings.every((h) => h.suggested === 0)).toBe(true);
  });
});

describe("reusing what you hold", () => {
  it("puts a 3 to 5 year goal's money into your flexi-cap fund instead of a new fund", () => {
    const funds = [inv("flexi", "mutual_fund", "flexi_cap", 300000, 10000)];
    const house: GoalInput = {
      id: "house",
      name: "House",
      type: "custom",
      target: 2000000,
      targetDate: "2030-11-23",
      inflationPct: null,
    };
    const s = sipSuggestions({
      goals: [trackGoal(house, funds, [], today)],
      investments: funds,
      links: [],
      today,
      budgetMonthly: 0,
    });
    expect(s.newFunds).toEqual([]);
    expect(s.holdings[0].suggested).toBeGreaterThan(0);
  });

  it("never uses equity for money needed within a year", () => {
    const funds = [inv("flexi", "mutual_fund", "flexi_cap", 300000)];
    const trip: GoalInput = {
      id: "trip",
      name: "Trip",
      type: "travel",
      target: 200000,
      targetDate: "2027-06-01",
      inflationPct: null,
    };
    const s = sipSuggestions({
      goals: [trackGoal(trip, funds, [], today)],
      investments: funds,
      links: [],
      today,
      budgetMonthly: 0,
    });
    expect(s.holdings[0].suggested).toBe(0);
    expect(s.newFunds.length).toBeGreaterThan(0);
  });
});
