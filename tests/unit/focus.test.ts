import { describe, expect, it } from "vitest";
import { betweenFocus, usualFocus } from "@/lib/focus";
import type { Runway, RunwayScenario } from "@/lib/runway";
import type { TrackedGoal } from "@/lib/tracker";

const scenario = (s: Partial<RunwayScenario>): RunwayScenario => ({
  until: "2027-01-31",
  lines: [],
  due: 100000,
  left: 0,
  leftWithOwed: 0,
  weeks: 11,
  weekly: 5000,
  ...s,
});
const run = (
  best: Partial<RunwayScenario>,
  worst: Partial<RunwayScenario>,
  owed = 0,
): Runway => ({
  liquid: 200000,
  owedToYou: owed,
  best: scenario({ until: "2027-01-05", ...best }),
  worst: scenario(worst),
});
const today = "2026-11-16";

describe("betweenFocus", () => {
  it("says covered when even the late salary date works", () => {
    const f = betweenFocus({
      today,
      runway: run({ left: 50000 }, { left: 10000 }),
      itemCount: 2,
      heldGoals: 4,
    });
    expect(f.tone).toBe("good");
    expect(f.where).toContain("31 Jan");
    expect(f.rest).toContain("4 other goals wait");
  });

  it("asks for balances and dues first when nothing is added yet, and keeps to three", () => {
    const f = betweenFocus({
      today,
      runway: run(
        { left: 5000 },
        {
          left: -20000,
          leftWithOwed: 2000,
          lines: [
            {
              key: "living",
              label: "Living costs",
              amount: 60000,
              date: "2027-01-31",
              source: "living",
              counted: true,
            },
            {
              key: "emi:a",
              label: "HDFC EMI",
              amount: 12000,
              date: "2026-12-05",
              source: "emi",
              counted: true,
            },
          ],
        },
        22000,
      ),
      itemCount: 0,
      heldGoals: 1,
    });
    expect(f.tone).toBe("close");
    expect(f.items.map((i) => i.key)).toEqual(["setup", "spend", "next"]);
    expect(f.items[2].title).toBe("Next payment: ₹12,000 on 5 Dec");
    expect(f.rest).toContain("Your other goal waits");
  });

  it("tells you to hold spending when there's no weekly room", () => {
    const f = betweenFocus({
      today,
      runway: run(
        { left: -1 },
        { left: -40000, leftWithOwed: -40000, weekly: 0 },
      ),
      itemCount: 1,
      heldGoals: 0,
    });
    expect(f.tone).toBe("short");
    expect(f.where).toContain("₹40,000");
    expect(f.items[0].title).toBe("Only spend on what can't wait");
  });
});

const goal = (id: string, over: Partial<TrackedGoal>) =>
  ({
    id,
    name: id,
    status: "on_track",
    targetDate: "2030-01-01",
    monthsToReach: 10,
    ...over,
  }) as TrackedGoal;

describe("usualFocus", () => {
  it("is calm when everything is on track", () => {
    const f = usualFocus({
      today,
      goals: [goal("A", {})],
      hasBudget: true,
      hasPlan: true,
      lastUpdated: "2026-11-01",
    });
    expect(f.tone).toBe("good");
    expect(f.items).toEqual([]);
  });

  it("points at goals that need a look, then the next step", () => {
    const f = usualFocus({
      today,
      goals: [
        goal("A", { status: "behind" }),
        goal("B", { status: "overdue" }),
      ],
      hasBudget: false,
      hasPlan: false,
      lastUpdated: "2026-08-01",
    });
    expect(f.items.map((i) => i.key)).toEqual(["goal:B", "goal:A", "budget"]);
    expect(f.where).toContain("One goal needs a look");
  });
});
