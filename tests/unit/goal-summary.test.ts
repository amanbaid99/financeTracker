import { describe, expect, it } from "vitest";
import { groupGoals } from "@/lib/goal-summary";
import { trackGoal, type TrackedGoal } from "@/lib/tracker";

const base = trackGoal({ id: "g", name: "A goal", type: "custom", target: 100000, targetDate: "2027-10-29", inflationPct: null }, [], [], "2026-10-29");
const goal = (id: string, overrides: Partial<TrackedGoal> = {}): TrackedGoal => ({ ...base, id, ...overrides });

describe("home goal grouping", () => {
  it("keeps unfunded, behind and overdue goals visible before quiet groups", () => {
    const goals = [goal("new"), goal("late", { status: "overdue" }), goal("behind", { status: "behind" }), goal("done", { status: "reached" })];
    const groups = groupGoals(goals);
    expect(groups.attention.map((g) => g.id)).toEqual(["new", "late", "behind"]);
    expect(groups.reached.map((g) => g.id)).toEqual(["done"]);
    expect(Object.values(groups).flat()).toHaveLength(goals.length);
    expect(goals.map((g) => g.id)).toEqual(["new", "late", "behind", "done"]);
  });

  it("folds a loan covered by EMIs away, but keeps an overdue loan visible", () => {
    const loan = trackGoal({ id: "loan", name: "Loan", type: "loan_payoff", target: 100000, targetDate: null, inflationPct: null, loan: { outstanding: 100000, ratePct: 8, emi: 10000, monthsLeft: null, asOf: "2026-10-29" } }, [], [], "2026-10-29");
    expect(loan.emisCloseFirst).toBe(true);
    const groups = groupGoals([loan, { ...loan, id: "overdue", status: "overdue" }]);
    expect(groups.loans.map((g) => g.id)).toEqual(["loan"]);
    expect(groups.attention.map((g) => g.id)).toEqual(["overdue"]);
  });

  it("never treats an undated goal with an unreachable pace as quietly on track", () => {
    const groups = groupGoals([goal("unreachable", { status: "on_track", targetDate: null, reachDate: null }), goal("steady", { status: "on_track" })]);
    expect(groups.attention.map((g) => g.id)).toEqual(["unreachable"]);
    expect(groups.growing.map((g) => g.id)).toEqual(["steady"]);
  });
});
