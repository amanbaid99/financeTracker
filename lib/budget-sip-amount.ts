import { applyBudgetRules, rowAmount, type BudgetSheet } from "./budget-sheet";
/** Shared by Budget's display and the SIP editor. Missing/no-salary budgets
 * preserve manual planning; an explicitly saved zero remains a real zero. */
export function budgetSipAmount(plan: BudgetSheet | null, saved = true): number | null {
  if (!saved || !plan || plan.noSalary) return null;
  const normalised = applyBudgetRules(plan);
  return normalised.rows.filter(r => r.category === "savings" || r.category === "investing")
    .reduce((sum, row) => sum + rowAmount(row, normalised.salary), 0);
}

/**
 * Fixed costs a month (Essentials, EMIs included) from a saved budget, for the
 * emergency fund's pace. Personal spending and Save & invest aren't fixed.
 * 0 when there's no saved budget.
 */
export function budgetEssentials(plan: BudgetSheet | null, saved = true): number {
  if (!saved || !plan) return 0;
  return plan.rows
    .filter((r) => !["personal", "savings", "investing"].includes(r.category))
    .reduce((sum, row) => sum + rowAmount(row, plan.salary), 0);
}
