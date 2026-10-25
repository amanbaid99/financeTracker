import { describe, expect, it } from "vitest";
import { categoryForHorizon, planMoney } from "@/lib/allocate";
import { trackGoal, type GoalInput, type Investment, type Link } from "@/lib/tracker";

const TODAY = "2026-10-25";
const goal = (over: Partial<GoalInput> & { id: string }): GoalInput => ({
  name: over.id,
  type: "custom",
  target: 300_000,
  targetDate: "2028-10-25",
  inflationPct: null,
  ...over,
});

function setup(goals: GoalInput[], investments: Investment[] = [], links: Link[] = []) {
  return { goals: goals.map((g) => trackGoal(g, investments, links, TODAY)), investments, links };
}

describe("money plan", () => {
  it("covers the nearest dated goal first, then gives the rest to open goals", () => {
    const s = setup([goal({ id: "trip" }), goal({ id: "house", target: 1_000_000, targetDate: null })]);
    const p = planMoney({ ...s, lump: 100_000, monthlyTotal: 20_000, todayISO: TODAY });
    const trip = p.suggestions.find((x) => x.goalId === "trip")!;
    expect(trip.lump).toBe(100_000);
    expect(trip.monthly).toBeGreaterThan(0);
    expect(trip.monthly % 500).toBe(0);
    expect(trip.category).toBe("short_debt_fund");
    expect(trip.after.status).toBe("on_track");
    const house = p.suggestions.find((x) => x.goalId === "house")!;
    expect(house.monthly).toBe(20_000 - trip.monthly);
    expect(house.after.reachDate).not.toBeNull();
    expect(p.stillShortMonthly).toBe(0);
    expect(p.leftoverMonthly).toBe(0);
  });

  it("counts running SIPs against the monthly amount and says when money falls short", () => {
    const inv: Investment[] = [
      { id: "a", kind: "mutual_fund", name: null, category: "equity_index", value: 0, monthlySip: 5_000, returnPct: null },
    ];
    const s = setup([goal({ id: "car", target: 2_000_000 })], inv, [{ goalId: "car", investmentId: "a", percent: 100 }]);
    const p = planMoney({ ...s, lump: 0, monthlyTotal: 15_000, todayISO: TODAY });
    expect(p.sipsNow).toBe(5_000);
    expect(p.monthlyFree).toBe(10_000);
    expect(p.suggestions[0].monthly).toBe(10_000);
    expect(p.stillShortMonthly).toBeGreaterThan(0);
  });

  it("skips reached goals and leaves extra money unassigned", () => {
    const inv: Investment[] = [
      { id: "a", kind: "fd", name: null, category: "fd_rd", value: 500_000, monthlySip: 0, returnPct: null },
    ];
    const s = setup([goal({ id: "done" })], inv, [{ goalId: "done", investmentId: "a", percent: 100 }]);
    const p = planMoney({ ...s, lump: 50_000, monthlyTotal: 10_000, todayISO: TODAY });
    expect(p.suggestions).toHaveLength(0);
    expect(p.leftoverLump).toBe(50_000);
    expect(p.leftoverMonthly).toBe(10_000);
  });

  it("picks safer funds for nearer goals", () => {
    expect(categoryForHorizon(6, "custom").category).toBe("liquid_fund");
    expect(categoryForHorizon(24, "custom").category).toBe("short_debt_fund");
    expect(categoryForHorizon(48, "custom").category).toBe("balanced_advantage");
    expect(categoryForHorizon(120, "custom").category).toBe("equity_index");
    expect(categoryForHorizon(120, "emergency_fund").category).toBe("liquid_fund");
  });
});
