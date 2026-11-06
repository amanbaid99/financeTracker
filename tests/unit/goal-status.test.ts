import { describe, expect, it } from "vitest";
import { gapOptions, goalHint, goalStatus, timeGroup } from "@/lib/goal-status";
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
  it("offers realistic trade-offs, each with what it then takes a month", () => {
    const g = trackGoal(goal({ target: 300000 }), [inv(77000, 3000)], link, TODAY);
    const o = gapOptions(g, TODAY, 500)!;
    expect(o.moreMonthly).toBe(g.extraSipNeeded - 500);
    expect(o.fromZero).toBe(false);
    expect(o.smaller!.target).toBe(240000);
    expect(o.smaller!.monthly).toBeLessThan(o.neededNow);
    expect(o.later!.date > "2028-02-01").toBe(true);
    expect(o.later!.monthly).toBeLessThan(o.neededNow);
  });

  it("never suggests cutting a big goal to what today's savings reach", () => {
    // Retirement-like: ₹1.65 Cr target, ₹2.15L saved, nothing going in.
    const g = trackGoal(
      goal({ type: "retirement", target: 16500000, targetDate: "2059-11-06" }),
      [inv(215000, 0)],
      link,
      TODAY,
    );
    const o = gapOptions(g, TODAY, 0)!;
    expect(o.fromZero).toBe(true);
    expect(o.smaller!.target).toBe(13200000);
    expect(o.later!.date).toBe("2062-11-06");
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
