import { describe, expect, it } from "vitest";
import { mergeConfig } from "@/lib/engine/config";
import {
  allocateToGoals,
  analyzeGoal,
  bandFor,
  estimateMonthsToGoal,
  futureValue,
  projectedValue,
  requiredSip,
  requiredStepUpSip,
  stepUpSipValue,
  suggestRetirement,
} from "@/lib/engine/goals";
import type { Goal, Holding } from "@/lib/engine/types";
import { TODAY } from "./fixtures";

const cfg = mergeConfig();

describe("future value", () => {
  it("inflates today's rupees", () => {
    expect(futureValue(100_000, 6, 0)).toBe(100_000);
    expect(futureValue(100_000, 6, 10)).toBeCloseTo(179_084.77, 1);
  });
});

describe("SIP formula", () => {
  it("matches the spec formula and round-trips with projectedValue", () => {
    const sip = requiredSip(1_000_000, 0, 12, 12);
    expect(sip).toBeCloseTo(78_068.11, 1);
    expect(projectedValue(0, sip, 12, 12)).toBeCloseTo(1_000_000, 4);
  });

  it("accounts for current savings growing at the same rate", () => {
    const sip = requiredSip(1_000_000, 200_000, 12, 24);
    expect(projectedValue(200_000, sip, 12, 24)).toBeCloseTo(1_000_000, 4);
    expect(sip).toBeLessThan(requiredSip(1_000_000, 0, 12, 24));
  });

  it("is negative when already funded", () => {
    expect(requiredSip(100_000, 200_000, 8, 24)).toBeLessThan(0);
  });

  it("with zero months the whole gap is due now", () => {
    expect(requiredSip(100_000, 40_000, 8, 0)).toBe(60_000);
    expect(requiredSip(100_000, 140_000, 8, 0)).toBe(-40_000);
  });

  it("with zero return it is a straight division", () => {
    expect(requiredSip(120_000, 0, 0, 12)).toBe(10_000);
  });
});

describe("horizon to category mapping", () => {
  it.each([
    [0.5, "under_1y", 6],
    [2, "1_to_3y", 6.5],
    [4, "3_to_5y", 8],
    [6, "5_to_7y", 9.5],
    [20, "7y_plus", 11],
  ])("%s years -> %s at %s%%", (years, key, ret) => {
    const { band } = bandFor(years, "moderate", cfg);
    expect(band.key).toBe(key);
    expect(band.returnPct).toBe(ret);
  });

  it("conservative shifts one band shorter, aggressive one longer", () => {
    expect(bandFor(6, "conservative", cfg).band.key).toBe("3_to_5y");
    expect(bandFor(4, "aggressive", cfg).band.key).toBe("5_to_7y");
    expect(bandFor(0.5, "conservative", cfg).band.key).toBe("under_1y");
  });

  it("never adds equity for an aggressive user on a short goal", () => {
    expect(bandFor(2, "aggressive", cfg).band.key).toBe("1_to_3y");
  });
});

const goal = (g: Partial<Goal> = {}): Goal => ({
  id: "g1",
  name: "House",
  type: "house_down_payment",
  targetToday: 1_000_000,
  targetDate: "2031-10-24",
  priority: 1,
  inflationRate: null,
  savedAmount: 0,
  ...g,
});

describe("analyzeGoal", () => {
  it("inflates by goal type and finds the monthly SIP", () => {
    const a = analyzeGoal(goal(), { holdings: [], allocations: [], risk: "moderate", todayISO: TODAY, cfg });
    expect(a.months).toBe(60);
    expect(a.inflationPct).toBe(7);
    expect(a.futureTarget).toBe(Math.round(1_000_000 * 1.07 ** 5));
    expect(a.band.key).toBe("5_to_7y");
    expect(a.requiredMonthly).toBeGreaterThan(0);
    expect(a.status).toBe("behind");
  });

  it("counts linked holdings by percentage and their SIPs toward status", () => {
    const holdings: Holding[] = [
      { id: "h", kind: "mutual_fund", name: "My fund", category: "flexi_cap", currentValue: 400_000, monthlySip: 30_000 },
    ];
    const a = analyzeGoal(goal(), {
      holdings,
      allocations: [{ goalId: "g1", holdingId: "h", percent: 50 }],
      risk: "moderate",
      todayISO: TODAY,
      cfg,
    });
    expect(a.linkedValue).toBe(200_000);
    expect(a.linkedSip).toBe(15_000);
    expect(a.status).toBe("on_track");
  });

  it("is funded when savings already cover the target", () => {
    const a = analyzeGoal(goal({ savedAmount: 5_000_000 }), {
      holdings: [],
      allocations: [],
      risk: null,
      todayISO: TODAY,
      cfg,
    });
    expect(a.alreadyFunded).toBe(true);
    expect(a.requiredMonthly).toBe(0);
    expect(a.status).toBe("funded");
  });

  it("flags a goal due now", () => {
    const a = analyzeGoal(goal({ targetDate: "2026-10-01", savedAmount: 100_000 }), {
      holdings: [],
      allocations: [],
      risk: null,
      todayISO: TODAY,
      cfg,
    });
    expect(a.dueNow).toBe(true);
    expect(a.requiredMonthly).toBe(900_000);
  });

  it("flags the glide path for equity-backed goals within 3 years", () => {
    const holdings: Holding[] = [
      { id: "h", kind: "mutual_fund", name: null, category: "equity_index", currentValue: 300_000, monthlySip: 0 },
    ];
    const a = analyzeGoal(goal({ targetDate: "2028-10-24" }), {
      holdings,
      allocations: [{ goalId: "g1", holdingId: "h", percent: 100 }],
      risk: "moderate",
      todayISO: TODAY,
      cfg,
    });
    expect(a.glidePath).toBe(true);
    expect(a.reason).toContain("Start moving");
  });

  it("adds PPF/NPS to long retirement goals", () => {
    const a = analyzeGoal(goal({ type: "retirement", targetDate: "2056-10-24" }), {
      holdings: [],
      allocations: [],
      risk: "moderate",
      todayISO: TODAY,
      cfg,
    });
    expect(a.categories).toContain("PPF");
    expect(a.categories).toContain("NPS");
  });
});

describe("allocateToGoals", () => {
  it("gives retirement its baseline first, then goals by priority and date", () => {
    const base = { holdings: [], allocations: [], risk: "moderate" as const, todayISO: TODAY, cfg };
    const goals = [
      analyzeGoal(goal({ id: "r", name: "Retire", type: "retirement", priority: 3, targetDate: "2056-10-24" }), base),
      analyzeGoal(goal({ id: "a", name: "Car", type: "vehicle", priority: 1, targetDate: "2029-10-24" }), base),
      analyzeGoal(goal({ id: "b", name: "Trip", type: "travel", priority: 1, targetDate: "2027-10-24" }), base),
    ];
    const split = allocateToGoals(goals, 60_000, 10_000);
    expect(split[0]).toEqual({ goalId: "r", amount: 10_000 });
    // Trip (same priority, nearer date) is funded before Car.
    expect(split[1].goalId).toBe("b");
    expect(split.reduce((s, x) => s + x.amount, 0)).toBe(60_000);
  });
});

describe("suggestRetirement", () => {
  it("suggests 25 years of essentials at age 60", () => {
    const s = suggestRetirement(600_000, 30, TODAY, cfg);
    expect(s.targetToday).toBe(15_000_000);
    expect(s.targetDate).toBe("2056-10-24");
  });
});

describe("step-up SIP", () => {
  it("with 0% step-up matches the flat SIP projection", () => {
    expect(stepUpSipValue(10_000, 0, 12, 36)).toBeCloseTo(projectedValue(0, 10_000, 12, 36), 4);
  });

  it("raises the SIP every 12 months", () => {
    // No return: 12 x 1000 + 12 x 1100 = 25,200
    expect(stepUpSipValue(1_000, 10, 0, 24)).toBeCloseTo(25_200, 6);
  });

  it("needs a lower starting SIP that still reaches the target", () => {
    const flat = requiredSip(2_000_000, 100_000, 11, 120);
    const start = requiredStepUpSip(2_000_000, 100_000, 11, 120, 10);
    expect(start).toBeLessThan(flat);
    expect(projectedValue(100_000, 0, 11, 120) + stepUpSipValue(start, 10, 11, 120)).toBeCloseTo(2_000_000, 2);
  });

  it("counts a linked holding's step-up in the goal projection", () => {
    const holding = (step: number | null): Holding => ({
      id: "h",
      kind: "mutual_fund",
      name: null,
      category: "flexi_cap",
      currentValue: 0,
      monthlySip: 10_000,
      sipStepUpPct: step,
    });
    const run = (step: number | null) =>
      analyzeGoal(goal({ targetDate: "2036-10-24" }), {
        holdings: [holding(step)],
        allocations: [{ goalId: "g1", holdingId: "h", percent: 100 }],
        risk: "moderate",
        todayISO: TODAY,
        cfg,
      });
    expect(run(10).projected).toBeGreaterThan(run(null).projected);
    expect(run(null).requiredMonthlyStepUp).toBeLessThan(run(null).requiredMonthly);
  });
});

describe("goals with no deadline", () => {
  const open = (g: Partial<Goal> = {}) => goal({ targetDate: null, targetToday: 500_000, type: "travel", ...g });
  const sipHolding = (sip: number, value = 0): Holding => ({
    id: "h",
    kind: "mutual_fund",
    name: null,
    category: "equity_index",
    currentValue: value,
    monthlySip: sip,
  });
  const ctx = (holdings: Holding[], allocations = [{ goalId: "g1", holdingId: "h", percent: 100 }]) => ({
    holdings,
    allocations: holdings.length ? allocations : [],
    risk: "moderate" as const,
    todayISO: TODAY,
    cfg,
  });

  it("estimates when a SIP reaches the inflating target", () => {
    const a = analyzeGoal(open(), ctx([sipHolding(10_000)]));
    expect(a.openEnded).toBe(true);
    expect(a.status).toBe("open");
    expect(a.requiredMonthly).toBe(0);
    expect(a.estimatedMonths).toBeGreaterThan(36);
    expect(a.estimatedMonths).toBeLessThan(60);
    expect(a.targetDate).not.toBeNull();
    // At the estimate, projected value covers the inflated target.
    expect(a.reason).toContain("with your linked SIPs");
  });

  it("a bigger SIP gets there sooner", () => {
    const slow = analyzeGoal(open(), ctx([sipHolding(5_000)])).estimatedMonths!;
    const fast = analyzeGoal(open(), ctx([sipHolding(20_000)])).estimatedMonths!;
    expect(fast).toBeLessThan(slow);
  });

  it("compounding alone works when returns beat inflation", () => {
    const a = analyzeGoal(open({ targetToday: 200_000 }), ctx([sipHolding(0, 100_000)]));
    // 11% return vs 6% inflation: roughly doubles relative to target in ~14-15 years.
    expect(a.estimatedMonths).toBeGreaterThan(150);
    expect(a.estimatedMonths).toBeLessThan(200);
    expect(a.reason).toContain("from compounding alone");
  });

  it("is never reached when savings grow slower than the cost", () => {
    const a = analyzeGoal(open({ inflationRate: 10, savedAmount: 100_000 }), ctx([]));
    expect(a.estimatedMonths).toBeNull();
    expect(a.status).toBe("open");
    expect(a.hintMonthly).toBeGreaterThan(0);
  });

  it("is funded when you already have enough", () => {
    const a = analyzeGoal(open({ savedAmount: 600_000 }), ctx([]));
    expect(a.estimatedMonths).toBe(0);
    expect(a.status).toBe("funded");
  });

  it("matches a hand simulation for one holding", () => {
    const m = estimateMonthsToGoal({
      targetToday: 120_000,
      inflationPct: 0,
      saved: 0,
      savedReturnPct: 0,
      holdings: [{ value: 0, sip: 10_000, stepUpPct: 0, returnPct: 0 }],
      maxMonths: 100,
    });
    expect(m).toBe(12);
  });
});
