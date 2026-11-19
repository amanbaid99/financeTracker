import { describe, expect, it } from "vitest";
import { reviewBudget, type BudgetReviewGoal } from "@/lib/budget-insights";
import { emptyBudgetSheet, type BudgetSheet, type BudgetSheetRow } from "@/lib/budget-sheet";
const row = (category: BudgetSheetRow["category"], value: number): BudgetSheetRow => ({ id: category, name: category, category, mode: "amount", value, loanId: null });
const plan = (...rows: BudgetSheetRow[]): BudgetSheet => ({ ...emptyBudgetSheet(100000), rows });
const goal = (over: Partial<BudgetReviewGoal> = {}): BudgetReviewGoal => ({ type: "custom", status: "behind", isLoan: false, monthlySip: 5000, extraSipNeeded: 5000, ...over });
describe("balanced budget review", () => {
  it("shows the income allocation with unassigned money and accurate widths", () => {
    const result = reviewBudget(plan(row("fixed", 40000), row("investing", 20000)));
    expect(result.slices.map((s) => [s.key, s.amount, s.percent, s.width])).toEqual([["fixed", 40000, 40, 40], ["investing", 20000, 20, 20], ["remaining", 40000, 40, 40]]);
    expect(result.insights.every((i) => i.tone === "good")).toBe(true);
  });
  it("reassures a funded plan without inventing an improvement or an ideal ratio", () => {
    const result = reviewBudget(plan(row("fixed", 60000), row("savings", 20000), row("personal", 20000)), [goal()]);
    expect(result.insights.map((i) => i.tone)).toEqual(["good", "good", "good"]);
    expect(result.insights[1].text).toContain("₹10,000");
    expect(result.insights[2].title).toBe("Room to enjoy your money");
    expect(result.insights.map((i) => i.text).join(" ")).not.toMatch(/cut|should|ideal|50\/30/);
  });
  it("compares total goal pace once, excluding reached goals, loan goals and unknown amounts", () => {
    const goals = [goal(), goal({ status: "reached", extraSipNeeded: 100000 }), goal({ isLoan: true, extraSipNeeded: 100000 }), goal({ monthlySip: 0, extraSipNeeded: 0 }), goal({ monthlySip: NaN })];
    const result = reviewBudget(plan(row("savings", 10000)), goals);
    expect(result.insights[1].text).toContain("₹10,000");
    expect(result.insights[1].text).toContain("1 tracked savings goal");
    expect(result.unmeasuredGoals).toBe(2);
    expect(result.goalComparison).toBe(true);
  });
  it("shows a goal gap as a reference instead of declaring the plan bad", () => {
    const result = reviewBudget(plan(row("fixed", 40000), row("savings", 5000)), [goal()]);
    expect(result.insights[0].tone).toBe("good");
    expect(result.insights[1].tone).toBe("neutral");
    expect(result.insights[1].text).toContain("₹5,000 difference");
  });
  it("flags overspending without a false healthy verdict and scales the bar explicitly", () => {
    const result = reviewBudget(plan(row("fixed", 100000), row("investing", 20000)), [goal()]);
    expect(result.overBudget).toBe(true);
    expect(result.insights[0].tone).toBe("attention");
    expect(result.insights[0].text).toContain("₹20,000");
    expect(result.insights[1].tone).toBe("neutral");
    expect(result.slices.reduce((sum, s) => sum + s.width, 0)).toBeCloseTo(100);
    expect(result.slices.reduce((sum, s) => sum + s.percent!, 0)).toBe(120);
    expect(result.slices.some((s) => s.key === "remaining")).toBe(false);
  });
  it("recognises completed safety goals while keeping early and invalid drafts neutral", () => {
    const funded = reviewBudget(plan(row("fixed", 100000)), [goal({ type: "emergency_fund", status: "reached" })]);
    expect(funded.insights.some((i) => i.title === "Your emergency target is covered")).toBe(true);
    for (const p of [emptyBudgetSheet(0), emptyBudgetSheet(100000), plan(row("fixed", NaN))]) {
      expect(reviewBudget(p).insights.every((i) => i.tone === "neutral")).toBe(true);
    }
  });
});
