import { z } from "zod";
import { ratioPlanSchema, splitRupees } from "./budget-ratios";

export const BUDGET_CATEGORIES = {
  fixed: "Fixed expense", variable: "Variable expense", investing: "Investing",
  savings: "Savings", debt: "Debt repayment", personal: "Personal / guilt-free",
} as const;
export const EXPENSE_PRESETS = [
  { value: "rent", name: "Rent", category: "fixed" },
  { value: "utilities", name: "Utilities", category: "fixed" },
  { value: "emi", name: "EMI", category: "fixed" },
  { value: "insurance", name: "Insurance", category: "fixed" },
  { value: "subscriptions", name: "Subscriptions", category: "fixed" },
  { value: "groceries", name: "Groceries", category: "variable" },
  { value: "transport", name: "Transport", category: "variable" },
  { value: "personal", name: "Personal spending", category: "personal" },
] as const;
export type SheetLoan = { id?: string; name: string; emi: number };
export const budgetRowSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().trim().min(1, "Name each budget item.").max(80),
  category: z.enum(["fixed", "variable", "investing", "savings", "debt", "personal"]),
  mode: z.enum(["amount", "percent"]), value: z.number().finite().min(0).max(1e9),
  loanId: z.string().uuid().nullable(),
}).superRefine((row, ctx) => {
  if (row.mode === "amount" && !Number.isInteger(row.value)) ctx.addIssue({ code: "custom", message: "Enter whole rupees." });
  if (row.mode === "percent" && (row.value > 10000 || Math.abs(row.value * 100 - Math.round(row.value * 100)) > 0.00001)) ctx.addIssue({ code: "custom", message: "Use a percentage with up to two decimal places." });
});
export const budgetSheetSchema = z.object({
  version: z.literal(2), salary: z.number().int().positive("Enter your monthly take-home income.").max(1e9),
  rows: z.array(budgetRowSchema).max(100), excludedLoanIds: z.array(z.string().uuid()).max(100).default([]),
}).superRefine((plan, ctx) => {
  if (new TextEncoder().encode(JSON.stringify(plan)).byteLength > 50000) ctx.addIssue({ code: "custom", message: "This budget is too large. Shorten item names or remove some rows." });
  const ids = new Set<string>(), loans = new Set<string>();
  for (const row of plan.rows) {
    if (ids.has(row.id) || (row.loanId && loans.has(row.loanId))) ctx.addIssue({ code: "custom", message: "Each item and loan can appear only once." });
    ids.add(row.id); if (row.loanId) loans.add(row.loanId);
    if (rowAmount(row, plan.salary) > 1e9) ctx.addIssue({ code: "custom", message: "An item exceeds the supported amount." });
  }
});
export type BudgetSheet = z.infer<typeof budgetSheetSchema>;
export type BudgetSheetRow = BudgetSheet["rows"][number];
export function rowAmount(row: BudgetSheetRow, salary: number): number {
  return row.mode === "amount" ? Math.round(row.value) : Math.round(salary * row.value / 100);
}
export function rowPercent(row: BudgetSheetRow, salary: number): number {
  return row.mode === "percent" ? row.value : salary > 0 ? Math.round(row.value / salary * 10000) / 100 : 0;
}
export function sheetTotals(plan: BudgetSheet) {
  const allocated = plan.rows.reduce((s, r) => s + rowAmount(r, plan.salary), 0);
  return { allocated, remaining: plan.salary - allocated, percent: plan.salary > 0 ? Math.round(allocated / plan.salary * 10000) / 100 : 0 };
}
export function emptyBudgetSheet(salary: number): BudgetSheet {
  return { version: 2, salary, rows: [], excludedLoanIds: [] };
}
/** Add active EMIs once. Preserve edits and remember intentionally removed loan rows. */
export function addScheduledEmis(plan: BudgetSheet, loans: SheetLoan[]): BudgetSheet {
  const active = new Set(loans.flatMap((l) => l.id && l.emi > 0 ? [l.id] : []));
  const rows = plan.rows.filter((r) => !r.loanId || active.has(r.loanId));
  const existing = new Set(rows.flatMap((r) => r.loanId ? [r.loanId] : []));
  for (const loan of loans) {
    if (!loan.id || loan.emi <= 0 || existing.has(loan.id) || plan.excludedLoanIds.includes(loan.id)) continue;
    rows.push({ id: `emi-${loan.id}`, name: `${loan.name} EMI`.slice(0, 80), category: "fixed", mode: "amount", value: loan.emi, loanId: loan.id });
    existing.add(loan.id);
  }
  return { ...plan, rows };
}
/** Old saved plans become editable rows. No database write happens during conversion. */
export function readBudgetSheet(raw: unknown, salary: number, loans: SheetLoan[]): BudgetSheet | null {
  if (raw == null) return addScheduledEmis(emptyBudgetSheet(salary), loans);
  const current = budgetSheetSchema.safeParse(raw);
  if (current.success) return addScheduledEmis(current.data, loans);
  const legacy = ratioPlanSchema.safeParse(raw);
  if (!legacy.success) return null;
  const plan = emptyBudgetSheet(legacy.data.salary);
  const amounts = splitRupees(plan.salary, legacy.data.buckets.map((b) => b.percent));
  // Scheduled EMIs consume existing debt allocations first, avoiding a duplicate charge on conversion.
  let coveredEmis = loans.reduce((s, l) => s + Math.max(0, l.emi), 0);
  for (const [i, bucket] of legacy.data.buckets.entries()) {
    let amount = amounts[i];
    if (bucket.kind === "debt") { const covered = Math.min(amount, coveredEmis); amount -= covered; coveredEmis -= covered; }
    if (!amount) continue;
    const category: BudgetSheetRow["category"] = bucket.kind === "custom" ? "variable" : bucket.kind;
    const childAmounts = splitRupees(amount, bucket.children.map((c) => c.percent));
    for (const [j, child] of bucket.children.entries()) if (childAmounts[j]) plan.rows.push({ id: `legacy-${child.id}`, name: child.label, category, mode: "amount", value: childAmounts[j], loanId: null });
    const remainder = amount - childAmounts.reduce((a, b) => a + b, 0);
    if (remainder) plan.rows.push({ id: `legacy-${bucket.id}`, name: bucket.label, category, mode: "amount", value: remainder, loanId: null });
  }
  return addScheduledEmis(plan, loans);
}
