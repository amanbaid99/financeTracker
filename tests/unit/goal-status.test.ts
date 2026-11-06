import { describe, expect, it } from "vitest";
import { gapOptions, goalHint, goalStatus, horizonGroup } from "@/lib/goal-status";
import type { Suggestion } from "@/lib/allocate";
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
    expect(horizonGroup(g, TODAY)).toBe("five");
  });

  it("calls a goal with nothing linked Not started, and a far date Later", () => {
    const g = trackGoal(goal({ targetDate: "2035-01-01" }), [], [], TODAY);
    expect(goalStatus(g, TODAY).label).toBe("Not started");
    expect(horizonGroup(g, TODAY)).toBe("beyond");
  });

  it("puts goals with no date under No fixed date", () => {
    const g = trackGoal(
      goal({ type: "emergency_fund", targetDate: null, inflationPct: 0 }),
      [inv(140000, 5000)],
      link,
      TODAY,
    );
    expect(horizonGroup(g, TODAY)).toBe("ongoing");
  });
});

describe("time groups", () => {
  const at = (targetDate: string) =>
    horizonGroup(trackGoal(goal({ targetDate }), [], [], TODAY), TODAY);
  it("puts each date in the right group", () => {
    expect(at("2026-11-20")).toBe("month");
    expect(at("2027-01-15")).toBe("quarter");
    expect(at("2027-04-01")).toBe("half");
    expect(at("2027-10-01")).toBe("year");
    expect(at("2030-06-01")).toBe("five");
    expect(at("2040-01-01")).toBe("beyond");
  });
});

describe("ways to close a gap", () => {
  it("offers one simple step: invest more a month", () => {
    const g = trackGoal(goal({ target: 300000 }), [inv(77000, 3000)], link, TODAY);
    const o = gapOptions(g, TODAY, 500)!;
    expect(o).toEqual({ moreMonthly: g.extraSipNeeded - 500, fromZero: false });
  });

  it("says start when nothing is going in yet", () => {
    const g = trackGoal(
      goal({ type: "retirement", target: 16500000, targetDate: "2059-11-06" }),
      [inv(215000, 0)],
      link,
      TODAY,
    );
    expect(gapOptions(g, TODAY, 0)!.fromZero).toBe(true);
  });

  it("offers nothing when the plan covers the goal", () => {
    const g = trackGoal(goal({}), [inv(77000, 3000)], link, TODAY);
    expect(gapOptions(g, TODAY, g.extraSipNeeded)).toBeNull();
  });
});

describe("current position and proposed plan", () => {
  it("does not call a bills fund covered when its proposed plan still has a shortfall", () => {
    const g = trackGoal(
      {
        id: "g",
        name: "Annual costs",
        type: "bills_fund",
        target: 0,
        targetDate: null,
        inflationPct: 0,
        bills: [
          {
            name: "Annual payment",
            amount: 120000,
            everyMonths: 12,
            nextDue: "2027-01-01",
          },
        ],
      },
      [inv(0, 100)],
      link,
      TODAY,
    );
    expect(g.billsFund?.short).not.toBeNull();
    expect(goalHint(g, TODAY, { after: g } as Suggestion)).toBe(
      "Plan still leaves a gap",
    );
    const covered = trackGoal(
      {
        ...g,
        bills: [
          {
            name: "Annual payment",
            amount: 120000,
            everyMonths: 12,
            nextDue: "2027-01-01",
          },
        ],
      },
      [inv(150000, 100)],
      link,
      TODAY,
    );
    expect(goalHint(g, TODAY, { after: covered } as Suggestion)).toBe(
      "Covered by your plan",
    );
  });
});
