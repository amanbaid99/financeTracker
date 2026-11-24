import { applyBudgetRules, rowAmount, type BudgetSheet } from "./budget-sheet";
/** Shared by Budget's display and the SIP editor. Missing/no-salary budgets
 * preserve manual planning; an explicitly saved zero remains a real zero. */
export function budgetSipAmount(plan: BudgetSheet | null, saved = true): number | null {
  if (!saved || !plan || plan.noSalary) return null;
  const normalised = applyBudgetRules(plan);
  return normalised.rows.filter(r => r.category === "savings" || r.category === "investing")
    .reduce((sum, row) => sum + rowAmount(row, normalised.salary), 0);
}
