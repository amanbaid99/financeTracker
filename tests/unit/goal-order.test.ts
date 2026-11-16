import { describe, expect, it } from "vitest";
import { orderGoals } from "@/lib/goal-order";
import type { TrackedGoal } from "@/lib/tracker";

const g = (name: string, over: Partial<TrackedGoal> = {}) =>
  ({
    id: name,
    name,
    type: "custom",
    status: "on_track",
    targetDate: "2030-01-01",
    months: 40,
    planRank: null,
    billsFund: null,
    loanState: null,
    emisCloseFirst: false,
    ...over,
  }) as unknown as TrackedGoal;

const loanState = { balance: 1000 } as TrackedGoal["loanState"];

describe("orderGoals", () => {
  it("keeps your order, on hold or not: bills funds first, unplaced EMI loans after, reached last", () => {
    const goals = [
      g("Done", { status: "reached", planRank: 1 }),
      g("HDFC", { loanState, emisCloseFirst: true }),
      g("Travel", { planRank: 3 }),
      g("Emergency", { planRank: 1, type: "emergency_fund" }),
      g("IDFC", { planRank: 2, loanState }),
      g("Sinking", { billsFund: {} as TrackedGoal["billsFund"] }),
    ];
    expect(orderGoals(goals, "2026-11-16").map((x) => x.name)).toEqual([
      "Sinking",
      "Emergency",
      "IDFC",
      "Travel",
      "HDFC",
      "Done",
    ]);
  });

  it("puts a placed EMI loan where you put it", () => {
    const goals = [
      g("Emergency", { planRank: 2 }),
      g("HDFC", { loanState, emisCloseFirst: true, planRank: 1 }),
    ];
    expect(orderGoals(goals, "2026-11-16").map((x) => x.name)).toEqual([
      "HDFC",
      "Emergency",
    ]);
  });

  it("uses the app's order without one: emergency fund first, EMI loans last", () => {
    const goals = [
      g("HDFC", { loanState, emisCloseFirst: true, targetDate: null }),
      g("Trip", { targetDate: "2027-01-01", months: 2 }),
      g("Emergency", { type: "emergency_fund", targetDate: null }),
    ];
    expect(orderGoals(goals, "2026-11-16").map((x) => x.name)).toEqual([
      "Emergency",
      "Trip",
      "HDFC",
    ]);
  });
});
