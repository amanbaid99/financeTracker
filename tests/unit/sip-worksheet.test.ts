import { expect, it } from "vitest";
import { sipWorksheet, type SipWorksheetInput } from "@/lib/sip-worksheet";
import type { GoalInput, Investment } from "@/lib/tracker";
const today = "2026-11-23";
const goals: GoalInput[] = [
  {
    id: "safety",
    name: "Safety",
    type: "emergency_fund",
    target: 120000,
    targetDate: null,
    inflationPct: 0,
    expectedReturnPct: 0,
  },
  {
    id: "travel",
    name: "Travel",
    type: "travel",
    target: 120000,
    targetDate: "2027-11-23",
    inflationPct: 0,
    expectedReturnPct: 0,
  },
  {
    id: "retirement",
    name: "Retirement",
    type: "retirement",
    target: 1200000,
    targetDate: "2036-11-23",
    inflationPct: 0,
    expectedReturnPct: 0,
  },
];
const investments: Investment[] = [
  {
    id: "cash",
    name: "Safety account",
    kind: "savings",
    category: "savings_account",
    value: 0,
    monthlySip: 0,
    returnPct: 0,
  },
  ...Array.from({ length: 5 }, (_, n) => ({
    id: `fund${n}`,
    name: `Held fund ${n}`,
    kind: "mutual_fund",
    category: "equity_index",
    value: 0,
    monthlySip: 0,
    returnPct: 0,
  })),
];
const links = investments.map((i) => ({
  goalId: i.id === "cash" ? "safety" : "retirement",
  investmentId: i.id,
  percent: 100,
}));
const input: SipWorksheetInput = {
  today,
  goals,
  investments,
  links,
  monthlySavings: 46000,
  allocationMode: "safety_deadline",
  monthlyEssentials: 10000,
  riskTolerance: "moderate",
};
it("autofills goals and lists every linked vehicle, even when a suggestion is zero", () => {
  const s = sipWorksheet(input);
  expect(s.rows.retirement).toHaveLength(5);
  expect(s.rows.retirement.map((v) => v.amount)).toEqual([
    1200, 1200, 1200, 1200, 1200,
  ]);
  const low = sipWorksheet({ ...input, monthlySavings: 40000 });
  expect(low.rows.retirement).toHaveLength(5);
  expect(low.rows.retirement.every((v) => v.amount === 0)).toBe(true);
});
it("keeps a vehicle exact while its goal and the remaining vehicles update", () => {
  const s = sipWorksheet({
    ...input,
    overrides: { retirement: 6800 },
    vehicleOverrides: { retirement: { "inv:fund0": 2000 } },
  });
  expect(s.rows.retirement.map((v) => v.amount)).toEqual([
    2000, 1200, 1200, 1200, 1200,
  ]);
  expect(
    s.result.goals.find((g) => g.goalId === "retirement")!.recommendedMonthly,
  ).toBe(6800);
  expect(s.result.totalMonthlyAllocated).toBe(46000);
  expect(
    s.result.goals.find((g) => g.goalId === "travel")!.recommendedMonthly,
  ).toBe(9200);
});
it("resplits a manually selected goal with the 1000 automatic minimum", () => {
  const s = sipWorksheet({ ...input, overrides: { retirement: 2400 } });
  expect(s.rows.retirement.map((v) => v.amount)).toEqual([1200, 1200, 0, 0, 0]);
});
it("manual vehicle floors survive restoration of a goal's automatic allocation", () => {
  const s = sipWorksheet({
    ...input,
    monthlySavings: 40000,
    vehicleOverrides: { retirement: { "inv:fund4": 500 } },
  });
  expect(s.rows.retirement.find((v) => v.key === "inv:fund4")!.amount).toBe(
    500,
  );
  expect(s.result.totalMonthlyAllocated).toBeLessThanOrEqual(40000);
});
it("respects an exact zero, never double-counts vehicle totals and preserves inputs", () => {
  const data = {
    ...input,
    overrides: { retirement: 4800 },
    vehicleOverrides: { retirement: { "inv:fund0": 0 } },
  };
  const copy = JSON.stringify(data);
  const s = sipWorksheet(data);
  expect(s.rows.retirement.find((v) => v.key === "inv:fund0")!.amount).toBe(0);
  expect(s.result.vehicles!.reduce((n, v) => n + v.total, 0)).toBe(
    s.result.totalMonthlyAllocated,
  );
  expect(JSON.stringify(data)).toBe(copy);
});
it("rejects over-budget, foreign vehicle and stale goal choices", () => {
  expect(() =>
    sipWorksheet({
      ...input,
      overrides: { safety: 30000, travel: 10000, retirement: 10000 },
    }),
  ).toThrow(/exceed/);
  expect(() =>
    sipWorksheet({
      ...input,
      vehicleOverrides: { retirement: { "inv:foreign": 1000 } },
    }),
  ).toThrow(/no longer/);
  expect(() =>
    sipWorksheet({
      ...input,
      vehicleOverrides: { missing: { "inv:fund0": 1000 } },
    }),
  ).toThrow(/no longer/);
});
it("is deterministic when database retrieval order changes", () => {
  const a = sipWorksheet(input),
    b = sipWorksheet({
      ...input,
      goals: [...goals].reverse(),
      investments: [...investments].reverse(),
      links: [...links].reverse(),
    });
  expect(b).toEqual(a);
});
it("recalculates projected funding after changing a monthly allocation", () => {
  const full = sipWorksheet(input),
    less = sipWorksheet({ ...input, overrides: { retirement: 1000 } });
  expect(
    less.result.goals.find((g) => g.goalId === "retirement")!.projectedCorpus,
  ).toBeLessThan(
    full.result.goals.find((g) => g.goalId === "retirement")!.projectedCorpus,
  );
});
it("aggregates a shared holding once while retaining both goal parts", () => {
  const shared = {
    ...investments[1],
    id: "shared",
    name: "Shared index fund",
    value: 100000,
  };
  const two = goals
    .slice(1)
    .map((g, n) => ({
      ...g,
      id: `g${n}`,
      type: "retirement",
      target: 1200000,
      targetDate: "2036-11-23",
    }));
  const s = sipWorksheet({
    ...input,
    goals: two,
    investments: [shared],
    links: two.map((g) => ({
      goalId: g.id,
      investmentId: shared.id,
      percent: 50,
    })),
    overrides: { g0: 2000, g1: 2000 },
    vehicleOverrides: {
      g0: { "inv:shared": 1500 },
      g1: { "inv:shared": 1500 },
    },
  });
  const vehicle = s.result.vehicles!.find((v) => v.key === "inv:shared")!;
  expect(vehicle.total).toBe(3000);
  expect(vehicle.parts).toHaveLength(2);
  expect(s.result.totalMonthlyAllocated).toBe(4000);
  expect(s.result.goals.reduce((n, g) => n + g.existingCoverage, 0)).toBe(
    100000,
  );
});
it("allows an explicit rounded-up contribution while keeping automatic recommendations capped",()=>{
 const s=sipWorksheet({...input,overrides:{retirement:11000}});const g=s.result.goals.find(g=>g.goalId==="retirement")!;expect(g.recommendedMonthly).toBe(11000);expect(g.projectedShortfall).toBe(0);expect(s.result.totalMonthlyAllocated).toBeLessThanOrEqual(46000);
});
it("never assigns new monthly money to a completed goal",()=>{
 expect(()=>sipWorksheet({...input,goals:goals.map(g=>g.id==="retirement"?{...g,completed:true}:g),overrides:{retirement:1000}})).toThrow(/Completed goals/);
});
it("a reused baseline produces the same worksheet and is never mutated",async()=>{
 const {sipWorksheetBaseline}=await import("@/lib/sip-worksheet");const baseline=sipWorksheetBaseline(input);const snapshot=JSON.stringify(baseline);const edited={...input,overrides:{retirement:6800},vehicleOverrides:{retirement:{"inv:fund0":2000}}};
 expect(sipWorksheet(edited,baseline)).toEqual(sipWorksheet(edited));expect(JSON.stringify(baseline)).toBe(snapshot);
});
it("fast live previews keep displayed projections identical to full confirmation",()=>{
 const full=sipWorksheet({...input,overrides:{retirement:1000}});const quick=sipWorksheet({...input,overrides:{retirement:1000},includeAlternatives:false});
 const displayed=(s:ReturnType<typeof sipWorksheet>)=>({goals:s.result.goals.map(g=>({...g,alternatives:{...g.alternatives,revisedDeadline:null}})),vehicles:s.result.vehicles,rows:s.rows});
 expect(displayed(quick)).toEqual(displayed(full));
});
