import { describe, expect, it } from "vitest";
import {
  freePercent,
  monthsToReach,
  projectedValue,
  requiredSip,
  trackGoal,
  type GoalInput,
  type Investment,
  type Link,
} from "@/lib/tracker";

const TODAY = "2026-10-25";

const inv = (over: Partial<Investment> & { id: string }): Investment => ({
  kind: "mutual_fund",
  name: null,
  category: "equity_index",
  value: 0,
  monthlySip: 0,
  returnPct: null,
  ...over,
});

const goal = (over: Partial<GoalInput> = {}): GoalInput => ({
  id: "g",
  name: "House",
  type: "house_down_payment",
  target: 1_000_000,
  targetDate: "2031-10-25",
  inflationPct: null,
  ...over,
});

describe("goal math", () => {
  it("projects savings plus SIP and finds the SIP needed", () => {
    expect(projectedValue(100_000, 0, 12, 12)).toBeCloseTo(112_682.5, 0);
    expect(projectedValue(0, 1000, 0, 10)).toBe(10_000);
    const sip = requiredSip(1_000_000, 100_000, 12, 60);
    expect(projectedValue(100_000, sip, 12, 60)).toBeCloseTo(1_000_000, 0);
    expect(requiredSip(100, 1000, 10, 12)).toBe(0);
  });

  it("finds months to reach a target", () => {
    expect(monthsToReach(1000, 1000, 0, 10)).toBe(0);
    expect(monthsToReach(12_000, 0, 1000, 0)).toBe(12);
    expect(monthsToReach(1000, 0, 0, 0)).toBeNull();
  });
});

describe("trackGoal", () => {
  it("adds up linked shares and says when a goal is behind", () => {
    const investments = [
      inv({ id: "a", value: 200_000, monthlySip: 5_000 }),
      inv({ id: "b", kind: "fd", category: "fd_rd", value: 100_000 }),
    ];
    const links: Link[] = [
      { goalId: "g", investmentId: "a", percent: 50 },
      { goalId: "g", investmentId: "b", percent: 100 },
      { goalId: "other", investmentId: "a", percent: 50 },
    ];
    const t = trackGoal(goal(), investments, links, TODAY);
    expect(t.current).toBe(200_000);
    expect(t.monthlySip).toBe(2_500);
    expect(t.months).toBe(60);
    // Blended from 11% (index fund) and 7% (FD).
    expect(t.returnPct).toBeGreaterThan(7);
    expect(t.returnPct).toBeLessThan(11);
    expect(t.status).toBe("behind");
    expect(t.extraSipNeeded).toBeGreaterThan(0);
    const fixed = projectedValue(t.current, t.monthlySip + t.extraSipNeeded, t.returnPct, 60);
    expect(fixed).toBeGreaterThanOrEqual(1_000_000);
  });

  it("is on track when the projection covers the target, and uses a custom return", () => {
    const t = trackGoal(
      goal({ target: 500_000 }),
      [inv({ id: "a", value: 300_000, monthlySip: 2_000, returnPct: 10 })],
      [{ goalId: "g", investmentId: "a", percent: 100 }],
      TODAY,
    );
    expect(t.returnPct).toBe(10);
    expect(t.status).toBe("on_track");
    expect(t.projected).toBeGreaterThan(500_000);
    expect(t.extraSipNeeded).toBe(0);
  });

  it("grows the target with inflation when set", () => {
    const t = trackGoal(goal({ inflationPct: 6 }), [], [], TODAY);
    expect(t.futureTarget).toBe(Math.round(1_000_000 * 1.06 ** 5));
    expect(t.status).toBe("no_investments");
    expect(t.extraSipNeeded).toBeGreaterThan(0);
  });

  it("estimates a date for goals without one", () => {
    const t = trackGoal(
      goal({ targetDate: null, target: 120_000 }),
      [inv({ id: "a", value: 0, monthlySip: 10_000, returnPct: 0 })],
      [{ goalId: "g", investmentId: "a", percent: 100 }],
      TODAY,
    );
    expect(t.monthsToReach).toBe(12);
    expect(t.reachDate).toBe("2027-10-25");
  });

  it("marks reached and overdue goals", () => {
    const links: Link[] = [{ goalId: "g", investmentId: "a", percent: 100 }];
    expect(trackGoal(goal({ target: 50 }), [inv({ id: "a", value: 100 })], links, TODAY).status).toBe("reached");
    expect(trackGoal(goal({ targetDate: "2026-01-01" }), [inv({ id: "a", value: 100 })], links, TODAY).status).toBe(
      "overdue",
    );
  });

  it("reports how much of an investment is still free", () => {
    const links: Link[] = [
      { goalId: "g1", investmentId: "a", percent: 60 },
      { goalId: "g2", investmentId: "a", percent: 30 },
    ];
    expect(freePercent("a", links)).toBe(10);
    expect(freePercent("a", links, "g1")).toBe(70);
    expect(freePercent("b", links)).toBe(100);
  });
});
