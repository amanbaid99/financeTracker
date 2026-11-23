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
      budgetMonthly: 10000,
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
      budgetMonthly: 10000,
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
      budgetMonthly: 10000,
    });
    expect(s.holdings[0].suggested).toBe(0);
    expect(s.newFunds.length).toBeGreaterThan(0);
  });
});

describe("1 to 3 year goals", () => {
  it("prefer an arbitrage fund you hold over a bank account", () => {
    const funds = [
      inv("bank", "savings", "savings_account", 10000),
      inv("arb", "mutual_fund", "arbitrage", 5000),
    ];
    const marriage: GoalInput = {
      id: "m",
      name: "Marriage",
      type: "wedding",
      target: 500000,
      targetDate: "2028-06-01",
      inflationPct: null,
    };
    const s = sipSuggestions({
      goals: [trackGoal(marriage, funds, [], today)],
      investments: funds,
      links: [],
      today,
      budgetMonthly: 10000,
    });
    expect(
      s.holdings.find((h) => h.investment.id === "arb")!.suggested,
    ).toBeGreaterThan(0);
    expect(s.holdings.find((h) => h.investment.id === "bank")!.suggested).toBe(
      0,
    );
  });
  it("still use the bank account when nothing better is held", () => {
    const funds = [inv("bank", "savings", "savings_account", 10000)];
    const marriage: GoalInput = {
      id: "m",
      name: "Marriage",
      type: "wedding",
      target: 500000,
      targetDate: "2028-06-01",
      inflationPct: null,
    };
    const s = sipSuggestions({
      goals: [trackGoal(marriage, funds, [], today)],
      investments: funds,
      links: [],
      today,
      budgetMonthly: 10000,
    });
    expect(s.holdings[0].suggested).toBeGreaterThan(0);
  });
});

it("zero savings never produces new contribution suggestions", () => {
  const funds = [inv("cash", "savings", "savings_account", 1000)];
  const goal: GoalInput = {
    id: "trip",
    name: "Trip",
    type: "travel",
    target: 100000,
    targetDate: "2027-06-01",
    inflationPct: null,
  };
  const s = sipSuggestions({
    goals: [trackGoal(goal, funds, [], today)],
    investments: funds,
    links: [],
    today,
    budgetMonthly: 0,
  });
  expect(s.basis).toBe(0);
  expect(s.inHoldings + s.inNewFunds).toBe(0);
  expect(s.goalsNeed).toBeGreaterThan(0);
});

it("uses exactly the same per-goal engine result as plan calculation, without a blanket minimum", async () => {
  const { hybridPlan } = await import("@/lib/hybrid-plan");
  const funds = [inv("bank", "savings", "savings_account", 0)];
  const goals = [
    {
      id: "small",
      name: "Small",
      type: "custom",
      target: 1200,
      targetDate: "2027-11-23",
      inflationPct: 0,
      expectedReturnPct: 0,
    },
    {
      id: "large",
      name: "Large",
      type: "custom",
      target: 120000,
      targetDate: "2027-11-23",
      inflationPct: 0,
      expectedReturnPct: 0,
    },
  ].map((g) => trackGoal(g as GoalInput, funds, [], today));
  const s = sipSuggestions({
    goals,
    investments: funds,
    links: [],
    today,
    budgetMonthly: 20000,
  });
  const result = hybridPlan({
    goals,
    investments: funds,
    links: [],
    today,
    monthlySavings: 20000,
  });
  expect(s.byGoal.map((g) => [g.goalId, g.monthly])).toEqual(
    result.goals.map((g) => [g.goalId, g.recommendedMonthly]),
  );
  expect(s.byGoal.find((g) => g.goalId === "small")!.monthly).toBe(100);
});

describe("exact holding choices recalculate automatic SIPs", () => {
  const investments = [
    inv("liquid", "mutual_fund", "liquid_fund", 0),
    inv("nps", "nps", null, 0),
    inv("gold", "gold", null, 0),
  ];
  const goal: GoalInput = {
    id: "safety",
    name: "Safety",
    type: "emergency",
    target: 300000,
    targetDate: "2027-11-23",
    inflationPct: 0,
  };
  const run = (
    minimums: Record<string, number> = {},
    links: { investmentId: string; goalId: string; percent: number }[] = [],
  ) =>
    sipSuggestions({
      goals: [trackGoal(goal, investments, links, today)],
      investments,
      links,
      today,
      budgetMonthly: 10000,
      minimums,
      exactHoldings: true,
    });
  const total = (s: ReturnType<typeof run>) => s.inHoldings + s.inNewFunds;
  it("reserves each chosen holding and reduces automatic recommendations by the same amount", () => {
    const baseline = run();
    const edited = run({ "inv:nps": 1000, "inv:gold": 1000 });
    expect(total(baseline)).toBe(10000);
    expect(total(edited)).toBe(10000);
    expect(
      edited.holdings.find((h) => h.investment.id === "liquid")?.suggested,
    ).toBe(8000);
    expect(
      edited.holdings.find((h) => h.investment.id === "nps")?.suggested,
    ).toBe(1000);
  });
  it("keeps a lowered automatic holding exact and redistributes the rest", () => {
    const edited = run({ "inv:liquid": 2000, "inv:nps": 1000 });
    expect(
      edited.holdings.find((h) => h.investment.id === "liquid")?.suggested,
    ).toBe(2000);
    expect(total(edited)).toBe(10000);
    expect(edited.inNewFunds).toBe(7000);
  });
  it("respects explicit zero and returns to automatic amounts when reset", () => {
    expect(
      run({ "inv:liquid": 0 }).holdings.find(
        (h) => h.investment.id === "liquid",
      )?.suggested,
    ).toBe(0);
    expect(total(run({ "inv:liquid": 0 }))).toBe(10000);
    expect(
      run().holdings.find((h) => h.investment.id === "liquid")?.suggested,
    ).toBe(10000);
  });
  it("does not count linked manual contributions twice", () => {
    const links = [{ investmentId: "liquid", goalId: "safety", percent: 100 }];
    const edited = run({ "inv:liquid": 2500 }, links);
    expect(total(edited)).toBe(10000);
    expect(edited.inNewFunds).toBe(7500);
  });
});

it("retains allocated corpus when an exact destination is excluded from automatic routing",()=>{
 const investments=[inv("liquid","mutual_fund","liquid_fund",120000)];
 const goal:GoalInput={id:"safety",name:"Safety",type:"emergency_fund",target:240000,targetDate:"2027-11-23",inflationPct:0};
 const links=[{investmentId:"liquid",goalId:"safety",percent:100}];
 const opts={goals:[trackGoal(goal,investments,links,today)],investments,links,today,budgetMonthly:10000,exactHoldings:true};
 const baseline=sipSuggestions(opts);
 const edited=sipSuggestions({...opts,minimums:{"inv:liquid":1000}});
 expect(edited.goalsNeed).toBe(baseline.goalsNeed);
 expect(edited.inHoldings).toBe(1000);
 expect(edited.inHoldings+edited.inNewFunds).toBe(baseline.inHoldings+baseline.inNewFunds);
});
