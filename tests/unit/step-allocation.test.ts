import { describe, expect, it } from "vitest";
import { emergencyFloor, stepAllocation } from "@/lib/step-allocation";
import { trackGoal, type GoalInput, type Investment } from "@/lib/tracker";

const today = "2026-11-24";
const goal = (g: Partial<GoalInput> & { id: string }): GoalInput => ({
  name: g.id,
  type: "custom",
  target: 100000,
  targetDate: null,
  inflationPct: null,
  ...g,
});
const t = (g: GoalInput, invs: Investment[] = []) =>
  trackGoal(g, invs, [], today);

describe("emergency floor", () => {
  it("is 1 month of costs over 3 months plus the next 2 months over 6", () => {
    const e = t(goal({ id: "e", type: "emergency_fund", target: 600000 }));
    // ₹40,000 a month of costs, nothing saved: 40,000/3 + 80,000/6 = 26,667.
    expect(emergencyFloor(e, 40000).monthly).toBe(26700);
  });
  it("counts what's already saved", () => {
    const cash: Investment = {
      id: "c",
      kind: "mutual_fund",
      name: "c",
      category: "liquid_fund",
      value: 40000,
      monthlySip: 0,
      returnPct: null,
    };
    const e = trackGoal(
      goal({ id: "e", type: "emergency_fund", target: 600000 }),
      [cash],
      [{ goalId: "e", investmentId: "c", percent: 100 }],
      today,
    );
    // 1 month done; 80,000 more over 6 months.
    expect(emergencyFloor(e, 40000).monthly).toBe(13400);
  });
});

describe("stepAllocation", () => {
  const goals = [
    t(goal({ id: "e", type: "emergency_fund", target: 600000 })),
    t(goal({ id: "trip", target: 60000, targetDate: "2027-05-24" })),
    t(goal({ id: "house", target: 2000000, targetDate: "2036-11-24" })),
    t(
      goal({
        id: "retire",
        type: "retirement",
        target: 20000000,
        targetDate: "2056-11-24",
      }),
    ),
  ];

  it("funds the emergency floor, gives ₹500 to every other goal, then the closest first", () => {
    const p = stepAllocation({
      goals,
      essentialsMonthly: 40000,
      budget: 40000,
    });
    const by = Object.fromEntries(p.lines.map((l) => [l.goalId, l.monthly]));
    expect(by.e).toBe(26700);
    expect(by.house).toBeGreaterThanOrEqual(500);
    expect(by.retire).toBe(500);
    // The trip (6 months away) gets the rest before the far goals.
    expect(by.trip).toBeGreaterThan(by.house);
    expect(p.lines.reduce((a, l) => a + l.monthly, 0)).toBeLessThanOrEqual(
      40000,
    );
  });

  it("covers the floor first even when the budget is small", () => {
    const p = stepAllocation({
      goals,
      essentialsMonthly: 40000,
      budget: 10000,
    });
    expect(p.lines.find((l) => l.goalId === "e")!.monthly).toBe(10000);
    expect(
      p.lines.filter((l) => l.goalId !== "e").every((l) => l.monthly === 0),
    ).toBe(true);
  });

  it("with no budget, shows what every goal needs", () => {
    const p = stepAllocation({ goals, essentialsMonthly: 40000, budget: 0 });
    expect(p.basis).toBe(p.need);
    expect(p.lines.every((l) => l.monthly > 0)).toBe(true);
  });
});
