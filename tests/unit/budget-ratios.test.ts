import { describe, expect, it } from "vitest";
import { defaultRatioPlan, ratioPlanSchema, ratioWarnings, splitRupees, suggestChildren, suggestRatioPlan, basisTotal, type RatioContext, approvedEmis } from "@/lib/budget-ratios";
import type { TrackedGoal } from "@/lib/tracker";
const context: RatioContext = { costs: [{ name: "Rent", amount: 30000 }], loanEmis: [{ id: "00000000-0000-4000-8000-000000000090", name: "Loan", emi: 10000 }], sips: 10000, goals: [], today: "2026-11-18" };
const goal = (n: number, type: string, need: number, sip = 0) => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, name: `Goal ${n}`, type, monthlySip: sip, extraSipNeeded: need, futureTarget: 100000, current: 0, months: 12, targetDate: "2027-11-18", status: "behind", planRank: n }) as TrackedGoal;

describe("ratio budgets", () => {
  it("conserves integer rupees across main and nested buckets", () => {
    expect(splitRupees(10001, [33.33, 33.33, 33.34])).toEqual([3333, 3333, 3335]);
    expect(splitRupees(15000, [60, 40])).toEqual([9000, 6000]);
    expect(splitRupees(101, [50])).toEqual([51]);
    expect(splitRupees(101, [60, 60])).toEqual([0, 0]);
    for (const n of [1, 7, 99999, 1e9]) expect(splitRupees(n, [50, 30, 20]).reduce((a, b) => a + b, 0)).toBe(n);
    expect(splitRupees(NaN, [100])).toEqual([0]);
  });
  it("rejects over/under main ratios, excess children, duplicate goals and invalid salary", () => {
    const p = defaultRatioPlan(100000);
    expect(ratioPlanSchema.safeParse(p).success).toBe(true);
    for (const salary of [0, -1, NaN, Infinity, 1.5, 1e10]) expect(ratioPlanSchema.safeParse({ ...p, salary }).success).toBe(false);
    expect(ratioPlanSchema.safeParse({ ...p, buckets: [{ ...p.buckets[0], percent: 99 }] }).success).toBe(false);
    const child = { id: "one", label: "Safety", percent: 60, goalId: goal(1, "custom", 1).id };
    const buckets = p.buckets.map((b) => ({ ...b }));
    buckets[0].children = [child, { ...child, id: "two" }];
    expect(ratioPlanSchema.safeParse({ ...p, buckets }).success).toBe(false);
    buckets[0].children = [{ ...child, percent: 40 }, { ...child, id: "two", percent: 40, goalId: null }];
    expect(ratioPlanSchema.safeParse({ ...p, buckets }).success).toBe(true);
    buckets[1].children = [{ ...child, id: "three", percent: 10 }];
    expect(ratioPlanSchema.safeParse({ ...p, buckets }).success).toBe(false);
  });
  it("includes recorded commitments once and changes savings when an emergency goal needs money", () => {
    const c = { ...context, goals: [goal(1, "emergency_fund", 2000, 3000)] };
    const { plan } = suggestRatioPlan(100000, c, [context.loanEmis[0].id!]);
    expect(plan.buckets.map((b) => b.percent)).toEqual([30, 27, 10, 33]);
    expect(basisTotal(plan.buckets)).toBe(10000);
    expect(ratioPlanSchema.safeParse(plan).success).toBe(true);
    expect(ratioWarnings(plan, c)).toEqual([]);
    expect(c.goals[0].monthlySip).toBe(3000);
  });
  it("excludes EMIs until explicitly selected, including from debt details and warnings", () => {
    const { plan } = suggestRatioPlan(100000, context);
    expect(plan.includedEmiIds).toEqual([]);
    expect(plan.buckets.find((b) => b.kind === "debt")?.percent).toBe(0);
    expect(suggestChildren(plan.buckets[2], 10000, context)).toEqual([]);
    expect(ratioWarnings(plan, context).join(" ")).not.toContain("scheduled EMIs");
    const selected = suggestRatioPlan(100000, context, [context.loanEmis[0].id!]).plan;
    expect(selected.buckets[2].percent).toBe(10);
    expect(selected.buckets[2].children[0].label).toBe("Loan");
    const newer = { ...context, loanEmis: [...context.loanEmis, { id: "00000000-0000-4000-8000-000000000091", name: "New loan", emi: 5000 }] };
    expect(approvedEmis(selected, newer).map((l) => l.name)).toEqual(["Loan"]);
    expect(suggestRatioPlan(100000, newer, selected.includedEmiIds).plan.buckets[2].percent).toBe(10);
  });
  it("loads older plans without assuming consent or changing saved amounts", () => {
    const old = defaultRatioPlan(100000);
    const { includedEmiIds: _, ...legacy } = old;
    void _;
    const restored = ratioPlanSchema.parse(legacy);
    expect(restored.includedEmiIds).toEqual([]);
    expect(restored.buckets).toEqual(old.buckets);
  });
  it("shows commitment shortfalls instead of treating a smaller salary as sufficient", () => {
    const { plan } = suggestRatioPlan(10000, context);
    expect(basisTotal(plan.buckets)).toBe(10000);
    expect(ratioWarnings(plan, context).join(" ")).toContain("exceed this salary");
    expect(ratioPlanSchema.safeParse(plan).success).toBe(true);
  });
  it("splits goals in priority order, excludes completed goals and leaves spare money unassigned", () => {
    const done = { ...goal(3, "emergency_fund", 50000), status: "reached" } as TrackedGoal;
    const children = suggestChildren(defaultRatioPlan(100000).buckets[3], 10000, { ...context, goals: [goal(2, "emergency_fund", 7000), done, goal(1, "emergency_fund", 4000)] });
    expect(children.map((c) => c.percent)).toEqual([40, 60]);
    expect(children.map((c) => c.goalId)).toEqual([goal(1, "custom", 1).id, goal(2, "custom", 1).id]);
    const one = suggestChildren(defaultRatioPlan(100000).buckets[3], 10000, { ...context, goals: [goal(1, "emergency_fund", 4000)] });
    expect(one[0].percent).toBe(40);
    expect(suggestChildren(defaultRatioPlan(100000).buckets[3], 0, context)).toEqual([]);
  });
  it("keeps suggested percentages at 100% even with awkward ratios and many costs", () => {
    for (let n = 1; n < 50; n++) {
      const c = { ...context, costs: [{ name: "Costs", amount: n * 137 }], sips: n * 17, loanEmis: [{ name: "EMI", emi: n * 73 }] };
      const { plan } = suggestRatioPlan(100003, c);
      expect(basisTotal(plan.buckets)).toBe(10000);
      expect(ratioPlanSchema.safeParse(plan).success).toBe(true);
    }
  });
});
