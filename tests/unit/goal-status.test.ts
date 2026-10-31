import { describe, expect, it } from "vitest";
import { gapOptions, goalStatus, timeGroup } from "@/lib/goal-status";
import { trackGoal, type GoalInput } from "@/lib/tracker";

const TODAY = "2026-10-31";
const goal = (over: Partial<GoalInput>): GoalInput =>
  ({
    id: "g",
    name: "Wedding",
    type: "wedding",
    target: 1500000,
    targetDate: "2028-02-01",
    inflationPct: 6,
    ...over,
  }) as GoalInput;
const inv = (value: number, sip: number) => ({
  id: "i",
  kind: "mutual_fund",
  name: "Arbitrage fund",
  category: "arbitrage",
  value,
  monthlySip: sip,
  returnPct: null,
});
const link = [{ goalId: "g", investmentId: "i", percent: 100 }];

describe("goal status", () => {
  it("labels a goal far behind as Behind, and groups it as soon", () => {
    const g = trackGoal(goal({}), [inv(77000, 3000)], link, TODAY);
    expect(goalStatus(g, TODAY)).toEqual({ label: "Behind", tone: "warning" });
    expect(timeGroup(g)).toBe("soon");
  });

  it("calls a goal with nothing linked Not started, and a far date Later", () => {
    const g = trackGoal(goal({ targetDate: "2035-01-01" }), [], [], TODAY);
    expect(goalStatus(g, TODAY).label).toBe("Not started");
    expect(timeGroup(g)).toBe("later");
  });

  it("puts goals with no date under No fixed date", () => {
    const g = trackGoal(
      goal({ type: "emergency_fund", targetDate: null, inflationPct: 0 }),
      [inv(140000, 5000)],
      link,
      TODAY,
    );
    expect(timeGroup(g)).toBe("ongoing");
  });
});

describe("ways to close a gap", () => {
  it("offers a later date, a smaller target and the extra a month", () => {
    const g = trackGoal(goal({ target: 300000 }), [inv(77000, 3000)], link, TODAY);
    const o = gapOptions(g, TODAY, 500)!;
    expect(o.moreMonthly).toBe(g.extraSipNeeded - 500);
    expect(o.lowerTarget).toBeGreaterThan(77000);
    expect(o.lowerTarget).toBeLessThan(300000);
    expect(o.newDate! > "2028-02-01").toBe(true);
    expect(o.newDate! < "2034-01-01").toBe(true);
  });

  it("leaves out a date when prices outrun the saving", () => {
    const g = trackGoal(goal({}), [inv(77000, 3000)], link, TODAY);
    expect(gapOptions(g, TODAY, 500)?.newDate).toBeNull();
  });

  it("offers nothing when the plan covers the goal", () => {
    const g = trackGoal(goal({}), [inv(77000, 3000)], link, TODAY);
    expect(gapOptions(g, TODAY, g.extraSipNeeded)).toBeNull();
  });
});
