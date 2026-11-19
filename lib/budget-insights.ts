import { formatINR } from "./format";
import { BUDGET_CATEGORIES, rowAmount, sheetTotals, type BudgetSheet, type BudgetSheetRow } from "./budget-sheet";

export type BudgetReviewGoal = {
  type: string; status: string; isLoan: boolean; isBillsFund?: boolean; monthlySip: number; extraSipNeeded: number;
};
export type BudgetInsight = { title: string; text: string; tone: "good" | "neutral" | "attention" };
export type AllocationSlice = { key: BudgetSheetRow["category"] | "remaining"; label: string; amount: number; percent: number | null; width: number };

/** Draft-only explanations. No score, fixed ideal ratio, financial action or external AI. */
export function reviewBudget(plan: BudgetSheet, goals: BudgetReviewGoal[] = []) {
  const validIncome = Number.isSafeInteger(plan.salary) && plan.salary > 0 && plan.salary <= 1e9;
  const validAmounts = plan.rows.every((r) => Number.isFinite(rowAmount(r, plan.salary)) && rowAmount(r, plan.salary) >= 0 && rowAmount(r, plan.salary) <= 1e9);
  if (!validAmounts) return { slices: [] as AllocationSlice[], insights: [{ title: "Check the amounts", text: "Enter valid amounts to see your allocation review.", tone: "neutral" as const }], goalComparison: false, unmeasuredGoals: 0, overBudget: false };
  const totals = sheetTotals(plan);
  const denominator = Math.max(validIncome ? plan.salary : 0, totals.allocated, 1);
  const byCategory = (category: BudgetSheetRow["category"]) => plan.rows.filter((r) => r.category === category).reduce((sum, r) => sum + rowAmount(r, plan.salary), 0);
  const slices: AllocationSlice[] = Object.entries(BUDGET_CATEGORIES).map(([key, label]) => {
    const amount = byCategory(key as BudgetSheetRow["category"]);
    return { key: key as BudgetSheetRow["category"], label, amount, percent: validIncome ? amount / plan.salary * 100 : null, width: amount / denominator * 100 };
  }).filter((s) => s.amount > 0);
  if (validIncome && totals.remaining > 0) slices.push({ key: "remaining", label: "Unassigned", amount: totals.remaining, percent: totals.remaining / plan.salary * 100, width: totals.remaining / denominator * 100 });
  if (!validIncome) return { slices, insights: [{ title: "Start with your income", text: "Enter your monthly take-home income to review the plan in context.", tone: "neutral" as const }], goalComparison: false, unmeasuredGoals: 0, overBudget: false };
  if (totals.allocated === 0) return { slices, insights: [{ title: "Your sheet is ready", text: "Add amounts for your expenses and goals. There is no required split to follow.", tone: "neutral" as const }], goalComparison: false, unmeasuredGoals: 0, overBudget: false };
  const format = formatINR;
  const insights: BudgetInsight[] = [];
  const overBudget = totals.remaining < 0;
  insights.push(overBudget
    ? { title: "A gap to resolve", text: `The plan is ${format(-totals.remaining)} above your monthly income. Check the entries or decide which amounts can change.`, tone: "attention" }
    : { title: "This fits your income", text: totals.remaining > 0 ? `${format(totals.allocated)} planned, with ${format(totals.remaining)} left unassigned.` : "Every rupee has a place, and the plan stays within your take-home income.", tone: "good" });
  const future = byCategory("savings") + byCategory("investing");
  const active = goals.filter((g) => g.status !== "reached" && !g.isLoan);
  const measurable = active.map((g) => ({ goal: g, need: Math.max(0, g.monthlySip) + Math.max(0, g.extraSipNeeded) })).filter((g) => Number.isFinite(g.need) && g.need > 0);
  const target = Math.ceil(measurable.reduce((sum, g) => sum + g.need, 0));
  const goalComparison = target > 0;
  if (goalComparison) {
    if (future >= target) insights.push({ title: overBudget ? "Goal capacity is planned" : "You have made room for your goals", text: `${format(future)} for saving and investing covers the ${format(target)} monthly pace recorded for ${measurable.length} tracked savings ${measurable.length === 1 ? "goal" : "goals"}.${overBudget ? " The income gap still needs resolving." : ""}`, tone: overBudget ? "neutral" : "good" });
    else insights.push({ title: "Your goals give this a reference point", text: `Saving and investing total ${format(future)}; the recorded monthly pace for ${measurable.length} savings ${measurable.length === 1 ? "goal is" : "goals is"} ${format(target)}. The ${format(target - future)} difference can be reviewed through your budget, targets or timelines.`, tone: "neutral" });
  } else if (future > 0) insights.push({ title: "Money for future you", text: `${format(future)} (${(future / plan.salary * 100).toFixed(1).replace(/\.0$/, "")}%) is reserved for saving and investing.${active.length ? " Your goals do not yet have a complete monthly pace to compare against." : " There is no single percentage you need to match."}`, tone: overBudget ? "neutral" : "good" });
  const emergency = goals.filter((g) => g.type === "emergency_fund" && !g.isLoan);
  if (emergency.length && emergency.every((g) => g.status === "reached")) insights.push({ title: "Your emergency target is covered", text: "Your tracked emergency goals have reached their current targets. That is useful progress to recognise.", tone: "good" });
  else if (byCategory("personal") > 0) insights.push({ title: overBudget ? "Personal spending is visible" : "Room to enjoy your money", text: `${format(byCategory("personal"))} is planned for personal or guilt-free spending.${overBudget ? " You can consider it alongside the rest of the plan." : " It has a deliberate place in the budget, too."}`, tone: overBudget ? "neutral" : "good" });
  else if (emergency.some((g) => g.status !== "reached") && future === 0) insights.push({ title: "Keep your safety goal in view", text: "You have an unfinished emergency goal and no saving or investing amount in this sheet yet. It is something to consider when you are ready.", tone: "neutral" });
  return { slices, insights: insights.slice(0, 3), goalComparison, unmeasuredGoals: active.length - measurable.length, overBudget };
}
