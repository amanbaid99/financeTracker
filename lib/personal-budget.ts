import { applyBudgetRules, rowAmount, type BudgetSheet, type BudgetSheetRow } from "./budget-sheet";

/** Recognisable recurring personal transport only, never loan EMIs or general travel goals. */
export const isPersonalTransport = (row: BudgetSheetRow) => !row.loanId && /^(daily commute|commute|transport|fuel|petrol|local travel|personal travel)\b/i.test(row.name.trim());
export function groupPersonalCosts(plan: BudgetSheet): BudgetSheet {
  if (plan.personalGrouping) return applyBudgetRules(plan);
  return applyBudgetRules({ ...plan, personalGrouping:true, rows: plan.rows.map(row => isPersonalTransport(row) && (row.category === "fixed" || row.category === "variable") ? { ...row, category: "personal" } : row) });
}
export function personalMinimum(rows: BudgetSheetRow[], salary: number) {
  return rows.filter(row => row.category === "personal" && row.id !== "rule-personal").reduce((sum,row)=>sum+rowAmount(row,salary),0);
}
export function calculatePersonalBudget(transport: number, daily: number, days: number, fun: number) {
  if (![transport,daily,days,fun].every(Number.isSafeInteger) || transport<0 || daily<0 || fun<0 || days<0 || days>31) return null;
  const everyday=daily*days;
  const total=transport+everyday+fun;
  return total<=1e9 ? {transport,everyday,fun,total} : null;
}
