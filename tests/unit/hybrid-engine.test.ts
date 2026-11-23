import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import {
  calculateHybrid,
  endMonthRequirement,
  endMonthValue,
  monthlyCapacity,
  checkedGoalLinks,
  weightedAllocate,
  type HybridInput,
} from "@/lib/hybrid-engine";
import { hybridPlan, hybridVehicles } from "@/lib/hybrid-plan";
import { proposeGoalMapping,sameGoalMapping } from "@/lib/hybrid-mapping";
import type { GoalInput, Investment } from "@/lib/tracker";
const today = "2026-11-22";
const goal = (id: string, extra: Partial<GoalInput> = {}): GoalInput => ({
  id,
  name: id,
  type: "custom",
  target: 120000,
  targetDate: "2027-11-22",
  inflationPct: 0,
  expectedReturnPct: 0,
  ...extra,
});
const inv = (
  id: string,
  value = 100000,
  extra: Partial<Investment> = {},
): Investment => ({
  id,
  name: null,
  kind: "savings",
  category: "savings_account",
  value,
  monthlySip: 0,
  returnPct: 0,
  valuationDate: today,
  ...extra,
});
const run = (goals: GoalInput[], extra: Partial<HybridInput> = {}) =>
  calculateHybrid({
    today,
    goals,
    investments: [],
    links: [],
    monthlySavings: 10000,
    ...extra,
  });
describe("hybrid funding calculator", () => {
  it("separates budget deficit and cash buffer", () => {
    expect(monthlyCapacity(100000, 50000, 20000, 10000)).toEqual({
      availableSavings: 20000,
      budgetDeficit: 0,
    });
    expect(monthlyCapacity(10000, 20000, 1000)).toEqual({
      availableSavings: 0,
      budgetDeficit: 11000,
    });
  });
  it("uses effective annual return and month-end contributions", () => {
    expect(endMonthValue(0, 1000, 12, 1)).toBe(1000);
    expect(endMonthValue(0, 1000, 0, 12)).toBe(12000);
    expect(endMonthRequirement(12000, 0, 0, 12)).toBe(1000);
    const rate = 1.12 ** (1 / 12) - 1;
    expect(endMonthRequirement(100000, 0, 12, 12)).toBe(
      Math.ceil((100000 * rate) / (1.12 - 1)),
    );
  });
  it("projects each assigned holding separately and excludes future SIPs from corpus", () => {
    const p = run([goal("g")], {
      investments: [inv("a", 50000, { monthlySip: 5000 }), inv("b", 100000)],
      links: [{ goalId: "g", investmentId: "a", percent: 100 }],
    });
    expect(p.goals[0].projectedExistingCorpus).toBe(50000);
    expect(p.goals[0].currentMonthly).toBe(5000);
    expect(p.goals[0].requiredMonthly).toBe(5834);
  });
  it("does not inflate a future-value target again", () => {
    expect(
      run([goal("g", { targetType: "future", inflationPct: 10 })]).goals[0]
        .targetCorpus,
    ).toBe(120000);
    expect(run([goal("g", { inflationPct: 10 })]).goals[0].targetCorpus).toBe(
      132000,
    );
  });
  it("changes requirements after deadline and value changes", () => {
    const investments = [inv("a", 60000)],
      links = [{ goalId: "g", investmentId: "a", percent: 100 }];
    expect(
      run([goal("g")], { investments, links }).goals[0].requiredMonthly,
    ).toBe(5000);
    expect(
      run([goal("g", { targetDate: "2028-11-22" })], { investments, links })
        .goals[0].requiredMonthly,
    ).toBe(2500);
    expect(
      run([goal("g")], { investments: [inv("a", 120000)], links }).goals[0]
        .requiredMonthly,
    ).toBe(0);
    expect(
      run([goal("g")], { investments: [inv("a", 30000)], links }).goals[0]
        .requiredMonthly,
    ).toBe(7500);
  });
  it("fully funded goals receive zero and retain excess", () => {
    const p = run([goal("g")], {
      investments: [inv("a", 150000)],
      links: [{ goalId: "g", investmentId: "a", percent: 100 }],
    });
    expect(p.goals[0].status).toBe("fully_funded");
    expect(p.goals[0].recommendedMonthly).toBe(0);
    expect(p.unallocatedSavings).toBe(10000);
  });
  it("uses the existing loan schedule without double funding EMIs", () => {
    const p = run([
      goal("loan", {
        type: "loan_payoff",
        targetDate: "2028-11-22",
        loan: {
          outstanding: 12000,
          emi: 1000,
          ratePct: 0,
          monthsLeft: 12,
          asOf: today,
        },
      }),
    ]);
    expect(p.goals[0].recommendedMonthly).toBe(0);
    expect(p.goals[0].requiredMonthly).toBe(0);
  });
  it("checks recurring bills by dates and flags cash needed before the first contribution", () => {
    const p = run([
      goal("bills", {
        type: "bills_fund",
        targetDate: null,
        bills: [
          {
            name: "Payment",
            amount: 1000,
            everyMonths: 1,
            nextDue: "2026-12-01",
          },
        ],
      }),
    ]);
    expect(p.goals[0].targetCorpus).toBe(12000);
    expect(p.goals[0].immediateShortfall).toBe(1000);
    expect(p.goals[0].status).toBe("underfunded");
    expect(p.immediateFundingShortfall).toBe(1000);
  });
  it("handles zero savings, overdue and current-month goals", () => {
    const p = run(
      [
        goal("old", { targetDate: "2026-10-01" }),
        goal("now", { targetDate: today }),
      ],
      { monthlySavings: 0 },
    );
    expect(p.totalMonthlyAllocated).toBe(0);
    expect(
      p.goals.every(
        (g) =>
          g.months === 0 &&
          g.requiredMonthly === 0 &&
          g.projectedShortfall === 120000,
      ),
    ).toBe(true);
  });
  it("handles negative returns without invalid arithmetic", () => {
    const p = run([goal("g", { expectedReturnPct: -5 })]);
    expect(p.goals[0].requiredMonthly).toBeGreaterThan(10000);
    expect(Number.isFinite(p.goals[0].projectedCorpus)).toBe(true);
    expect(() => run([goal("g", { expectedReturnPct: -100 })])).toThrow();
  });
  it("keeps undated goals explicit and emergency build assumptions visible", () => {
    const p = run([
      goal("u", { targetDate: null }),
      goal("e", { type: "emergency_fund",targetDate:null }),
    ]);
    expect(p.goals.find((g) => g.goalId === "u")?.recommendedMonthly).toBe(0);
    expect(p.goals.find((g) => g.goalId === "u")?.needsDate).toBe(true);
    expect(
      p.goals.find((g) => g.goalId === "e")?.assumptions.emergencyBuildMonths,
    ).toBe(12);
  });
  it("uses one-time money only as planned money and keeps sources untouched", () => {
    const investments = [inv("a", 10000)],
      original = JSON.stringify(investments);
    const p = run([goal("g")], { investments, oneTime: 12000 });
    expect(p.goals[0].existingCoverage).toBe(0);
    expect(p.goals[0].oneTimeAllocated).toBe(12000);
    expect(p.goals[0].requiredMonthly).toBe(9000);
    expect(JSON.stringify(investments)).toBe(original);
  });
  it("reports valuations and risk while assuming holdings are available", () => {
    const holdings = [
      inv("stale", 10000, { valuationDate: "2020-01-01" }),
      inv("missing", 10000, { valuationDate: null }),
      inv("pledged", 10000, { availability: "pledged" }),
      inv("locked", 10000, { availability: "locked" }),
      inv("equity", 10000, { kind: "stock", category: "direct_equity" }),
    ];
    const p = run([goal("g")], {
      investments: holdings,
      links: holdings.map((i) => ({
        goalId: "g",
        investmentId: i.id,
        percent: 100,
      })),
    });
    expect(p.goals[0].existingCoverage).toBe(50000);
    expect(p.goals[0].warnings.join(" ")).toMatch(/valuation|Valuation/);
    expect(p.goals[0].warnings.join(" ")).toContain("Risk");
  });
});
describe("hybrid allocation phases", () => {
  it("funds all essential minimums before remaining essentials or flexible goals", () => {
    const p = run(
      [
        goal("a", {
          goalCategory: "essential",
          minimumMonthly: 2000,
          planRank: 1,
        }),
        goal("b", {
          goalCategory: "essential",
          minimumMonthly: 2000,
          planRank: 2,
        }),
        goal("c", { minimumMonthly: 5000 }),
      ],
      { monthlySavings: 5000 },
    );
    expect(p.goals.map((g) => g.recommendedMonthly)).toEqual([3000, 2000, 0]);
  });
  it("uses essential ranking, deadline and ID when minimums exceed capacity", () => {
    const p = run(
      [
        goal("z", {
          goalCategory: "essential",
          minimumMonthly: 4000,
          planRank: 2,
        }),
        goal("b", {
          goalCategory: "essential",
          minimumMonthly: 4000,
          planRank: 1,
        }),
        goal("a", {
          goalCategory: "essential",
          minimumMonthly: 4000,
          planRank: 1,
        }),
      ],
      { monthlySavings: 5000 },
    );
    expect(p.goals.map((g) => g.recommendedMonthly)).toEqual([4000, 1000, 0]);
    expect(p.goals.find((g) => g.goalId === "b")?.minimumShortfall).toBe(3000);
  });
  it("keeps savings outside a user-chosen plan limit visible", () => {
    const p = run([goal("a"), goal("b")], {
      monthlySavings: 20000,
      monthlyPlanLimit: 5000,
    });
    expect(p.totalMonthlyAllocated).toBe(5000);
    expect(p.availableMonthlySavings).toBe(20000);
    expect(p.unallocatedSavings).toBe(15000);expect(p.goals.every(g=>g.status==="at_risk")).toBe(true);
  });
  it("weights flexible minimums when they cannot all be met", () => {
    const p = run(
      [
        goal("a", { priorityLevel: "high", minimumMonthly: 6000 }),
        goal("b", { priorityLevel: "low", minimumMonthly: 6000 }),
      ],
      { monthlySavings: 4000 },
    );
    expect(p.goals.map((g) => g.recommendedMonthly)).toEqual([3000, 1000]);
  });
  it("redistributes capped shares and leaves excess unallocated", () => {
    const out = weightedAllocate(100, [
      { id: "a", cap: 10, weight: new Decimal(100) },
      { id: "b", cap: 200, weight: new Decimal(1) },
    ]);
    expect(out).toEqual({ a: 10, b: 90 });
    const p = run([goal("a", { target: 12000 }), goal("b", { target: 12000 })]);
    expect(p.totalMonthlyAllocated).toBe(2000);
    expect(p.unallocatedSavings).toBe(8000);
  });
  it("preserves manual overrides and rejects over-budget or over-need amounts", () => {
    expect(
      run([goal("a"), goal("b")], { overrides: { a: 2000 } }).goals[0]
        .recommendedMonthly,
    ).toBe(2000);
    expect(() => run([goal("a")], { overrides: { a: 11000 } })).toThrow();
    expect(() =>
      run([goal("a"), goal("b")], { overrides: { a: 9000, b: 9000 } }),
    ).toThrow();
  });
  it("makes status thresholds configurable and calculates alternatives", () => {
    const g = goal("a");
    expect(run([g], { monthlySavings: 9500 }).goals[0].status).toBe("at_risk");
    expect(
      run([g], {
        monthlySavings: 9500,
        policy: { atRiskMonthlyIncreasePct: 0 },
      }).goals[0].status,
    ).toBe("underfunded");
    expect(
      run([g], { monthlySavings: 5000 }).goals[0].alternatives.revisedDeadline,
    ).toBe("2028-11-22");
  });
  it("is deterministic across retrieval orders and never creates rounding money", () => {
    for (let budget = 0; budget < 50; budget++) {
      const goals = [goal("c"), goal("a"), goal("b")],
        p = run(goals, { monthlySavings: budget }),
        q = run([...goals].reverse(), { monthlySavings: budget });
      expect(p).toEqual(q);
      expect(p.totalMonthlyAllocated + p.unallocatedSavings).toBe(budget);
      expect(
        p.goals.every(
          (g) =>
            Number.isInteger(g.recommendedMonthly) &&
            g.recommendedMonthly <= g.requiredMonthly,
        ),
      ).toBe(true);
    }
  });
});
it("detects material ownership edits regardless of retrieval order",()=>{const a=[{goalId:"a",investmentId:"one",percent:50},{goalId:"b",investmentId:"one",percent:50}];expect(sameGoalMapping(a,[...a].reverse())).toBe(true);expect(sameGoalMapping(a,[a[0]])).toBe(false);expect(sameGoalMapping(a,[{...a[0],percent:49},a[1]])).toBe(false);});
describe("proportional ownership and plan integration", () => {
  it("prevents duplicate ownership and over-allocation", () => {
    expect(() =>
      checkedGoalLinks(
        [goal("a"), goal("b")],
        [inv("i")],
        [
          { goalId: "a", investmentId: "i", percent: 60 },
          { goalId: "b", investmentId: "i", percent: 50 },
        ],
      ),
    ).toThrow();
  });
  it("shares one investment without double-counting and releases deleted/completed goals", () => {
    const investments = [inv("i", 500000)],
      links = [
        { goalId: "a", investmentId: "i", percent: 40 },
        { goalId: "b", investmentId: "i", percent: 50 },
      ];
    const p = run([goal("a"), goal("b")], { investments, links });
    expect(p.goals.reduce((s, g) => s + g.existingCoverage, 0)).toBe(450000);
    expect(p.unallocatedInvestments[0].value).toBe(50000);
    expect(
      run([goal("b", { completed: true })], { investments, links })
        .unallocatedInvestments[0].value,
    ).toBe(500000);
  });
  it("keeps confirmed ownership stable when proposing more coverage", () => {
    const links = [{ goalId: "a", investmentId: "i", percent: 50 }];
    const proposed = proposeGoalMapping(
      [goal("a"), goal("b")],
      [inv("i", 500000)],
      links,
      today,
    );
    expect(
      proposed.find((l) => l.goalId === "a")!.percent,
    ).toBeGreaterThanOrEqual(50);
    expect(proposed.reduce((s, l) => s + l.percent, 0)).toBeLessThanOrEqual(
      100,
    );
  });
  it("proposes releasing surplus only when explicitly reviewing a refreshed mapping", () => {
    const investments = [inv("i", 500000)],
      goals = [goal("a")],
      links = [{ goalId: "a", investmentId: "i", percent: 100 }];
    expect(
      proposeGoalMapping(goals, investments, links, today)[0].percent,
    ).toBe(100);
    const refreshed = proposeGoalMapping(goals, investments, links, today, {
      refresh: true,
    });
    expect(refreshed[0].percent).toBe(24);
    expect(links[0].percent).toBe(100);
  });
  it("keeps custom essential and travel vehicles separate in mapping and contributions", () => {
    const investments = [
        inv("liquid", 20000, { kind: "mutual_fund", category: "liquid_fund" }),
        inv("bank", 20000),
      ],
      goals = [
        goal("e", { type: "custom", goalCategory:"essential" }),
        goal("t", { type: "travel" }),
      ];
    const links = proposeGoalMapping(goals, investments, [], today);
    const safety = new Set(
      links.filter((l) => l.goalId === "e").map((l) => l.investmentId),
    );
    expect(
      links
        .filter((l) => l.goalId === "t")
        .every((l) => !safety.has(l.investmentId)),
    ).toBe(true);
  });
  it("counts named minimums inside the same budget and vehicle totals", () => {
    const investments = [inv("i", 0)],
      goals = [goal("g")],
      links = [{ goalId: "g", investmentId: "i", percent: 100 }],
      input = {
        today,
        goals,
        investments,
        links,
        monthlySavings: 10000,
        minimums: { "inv:i": 2000 },
      };
    const p = hybridPlan(input);
    const rows = hybridVehicles(input, p);
    expect(rows.reduce((s, r) => s + r.total, 0)).toBeLessThanOrEqual(10000);
    expect(p.totalMonthlyAllocated + p.unallocatedSavings).toBe(10000);
  });
  it("preserves both destination floors when holdings share a goal", () => {
    const investments = [inv("a", 0), inv("b", 0)],
      goals = [goal("g", { target: 72000 })],
      links = investments.map((i) => ({
        goalId: "g",
        investmentId: i.id,
        percent: 100,
      }));
    const input = {
      today,
      goals,
      investments,
      links,
      monthlySavings: 10000,
      minimums: { "inv:a": 5000, "inv:b": 5000 },
    };
    const result = hybridPlan(input),
      rows = hybridVehicles(input, result);
    expect(rows.find((r) => r.key === "inv:a")?.total).toBeGreaterThanOrEqual(
      5000,
    );
    expect(rows.find((r) => r.key === "inv:b")?.total).toBeGreaterThanOrEqual(
      5000,
    );
    expect(rows.reduce((s, r) => s + r.total, 0)).toBe(10000);
  });
  it("does not mutate historical results after recalculation", () => {
    const p = run([goal("a")]),
      snapshot = JSON.stringify(p);
    run([goal("a", { target: 500000 })]);
    expect(JSON.stringify(p)).toBe(snapshot);
  });
});
