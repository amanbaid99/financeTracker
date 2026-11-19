import { formatINR } from "./format";
import { EXPENSE_PRESETS, budgetSheetSchema, rowAmount, type BudgetSheet, type BudgetSheetRow, type SheetLoan } from "./budget-sheet";
import type { BudgetReviewGoal } from "./budget-insights";

export type KnownBudgetCost = { id: string; name: string; amount: number };
export type AssistedItem = { row: BudgetSheetRow; included: boolean; source: string };
export type ExtraAllocation = { savings: number; investing: number; personal: number };
/** Names that are the same every month; anything else counts as variable. */
const FIXED_LIKE = /\b(rent|emi|loan|insurance|premium|utilit|electric|internet|wifi|broadband|phone|mobile|subscription|fees?|tuition|maintenance)/i;
/** New rows from records: known costs, EMIs and SIPs, without duplicates. */
export function fillFromRecords(plan: BudgetSheet, costs: KnownBudgetCost[], loans: SheetLoan[], recordedSips = 0): BudgetSheet {
  return confirmedBudget(plan, plan.salary, knownBudgetItems(plan, costs, loans, recordedSips), []);
}
const normalise = (name: string) => name.trim().toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
const isExpense = (r: BudgetSheetRow) => r.category !== "savings" && r.category !== "investing";

/** Proposal only: imported IDs remain stable, and an existing manual expense wins over a same-name record. */
export function knownBudgetItems(plan: BudgetSheet, costs: KnownBudgetCost[], loans: SheetLoan[], recordedSips = 0): AssistedItem[] {
  const items: AssistedItem[] = plan.rows.map((row) => ({ row: { ...row }, included: true, source: row.loanId ? "Loan EMI" : "Current budget draft" }));
  const ids = new Set(plan.rows.map((r) => r.id));
  const originalIds = new Set(ids);
  const names = new Set(plan.rows.filter(isExpense).map((r) => normalise(r.name)));
  for (const cost of costs) {
    const id = `recorded-cost-${cost.id}`;
    if (!Number.isSafeInteger(cost.amount) || cost.amount <= 0 || cost.amount > 1e9) continue;
    const existing = items.find((item) => item.row.id === id || (originalIds.has(item.row.id) && isExpense(item.row) && normalise(item.row.name) === normalise(cost.name)));
    if (existing) {
      if (rowAmount(existing.row, plan.salary) !== cost.amount) existing.source += `; records show ${formatINR(cost.amount)}`;
      continue;
    }
    if (ids.has(id) || names.has(normalise(cost.name))) continue;
    const preset = EXPENSE_PRESETS.find((p) => normalise(p.name) === normalise(cost.name));
    items.push({ row: { id, name: cost.name.slice(0, 80), category: preset?.category ?? (FIXED_LIKE.test(cost.name) ? "fixed" : "variable"), mode: "amount", value: cost.amount, loanId: null }, included: !(/\bemi\b/i.test(cost.name) && loans.length > 0), source: /\bemi\b/i.test(cost.name) && loans.length > 0 ? "May overlap with loan EMIs; include only if separate" : "Income and cost records" });
    ids.add(id);
  }
  const existingLoans = new Set(plan.rows.flatMap((r) => r.loanId ? [r.loanId] : []));
  for (const loan of loans) {
    if (!loan.id || existingLoans.has(loan.id) || !Number.isSafeInteger(loan.emi) || loan.emi <= 0) continue;
    items.push({ row: { id: `emi-${loan.id}`, name: `${loan.name} EMI`.slice(0, 80), category: "fixed", mode: "amount", value: loan.emi, loanId: loan.id }, included: !plan.excludedLoanIds.includes(loan.id), source: "Loan EMI, previously left out" });
    existingLoans.add(loan.id);
  }
  if (Number.isSafeInteger(recordedSips) && recordedSips > 0 && recordedSips <= 1e9 && !items.some((i) => i.row.id === "recorded-sips")) {
    const hasFutureBudget = plan.rows.some((r) => r.category === "savings" || r.category === "investing");
    items.push({ row: { id: "recorded-sips", name: "Existing monthly SIPs", category: "investing", mode: "amount", value: recordedSips, loanId: null }, included: !hasFutureBudget, source: hasFutureBudget ? "Recorded SIPs; include only if not covered by your current allocations" : "Recorded monthly SIPs" });
  }
  return items;
}
export function confirmedBudget(original: BudgetSheet, salary: number, items: AssistedItem[], extras: BudgetSheetRow[]): BudgetSheet {
  const excluded = new Set(original.excludedLoanIds);
  for (const item of items) if (item.row.loanId) {
    if (item.included) excluded.delete(item.row.loanId); else excluded.add(item.row.loanId);
  }
  return { ...original, salary, rows: [...items.filter((i) => i.included).map((i) => ({ ...i.row })), ...extras.map((r) => ({ ...r }))], excludedLoanIds: [...excluded] };
}
const categoryAmount = (plan: BudgetSheet, category: BudgetSheetRow["category"]) => plan.rows.filter((r) => r.category === category).reduce((sum, r) => sum + rowAmount(r, plan.salary), 0);
export const moneyAvailable = (plan: BudgetSheet) => plan.salary - plan.rows.reduce((sum, r) => sum + rowAmount(r, plan.salary), 0);

/** Reuse the current discretionary mix. Largest remainders keep every rupee accounted for. */
export function suggestRemainingAllocation(plan: BudgetSheet): ExtraAllocation {
  const categories = ["savings", "investing", "personal"] as const;
  const available = Math.max(0, moneyAvailable(plan));
  const amounts = categories.map((category) => categoryAmount(plan, category));
  const total = amounts.reduce((a, b) => a + b, 0);
  const weights = total > 0 ? amounts : [40, 40, 20];
  const denominator = total || 100;
  const raw = weights.map((weight) => available * weight / denominator);
  const values = raw.map(Math.floor);
  const order = raw.map((value, index) => ({ index, remainder: value - values[index] })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const left = available - values.reduce((a, b) => a + b, 0);
  for (let i = 0; i < left; i++) values[order[i % order.length].index]++;
  return { savings: values[0], investing: values[1], personal: values[2] };
}

/** Allocate the actual remainder, never the gross salary or already committed SIPs a second time. */
export function suggestAssistedAllocation(plan: BudgetSheet, goals: BudgetReviewGoal[]) {
  const available = Math.max(0, moneyAvailable(plan));
  const personal = categoryAmount(plan, "personal") > 0 ? 0 : Math.round(available * 0.2);
  let future = available - personal;
  const active = goals.filter((g) => !g.isLoan && g.status !== "reached");
  const safety = active.filter((g) => g.type === "emergency_fund" || g.isBillsFund);
  const need = (list: BudgetReviewGoal[]) => list.reduce((sum, g) => {
    const amount = Math.max(0, g.monthlySip) + Math.max(0, g.extraSipNeeded);
    return sum + (Number.isFinite(amount) ? Math.ceil(amount) : 0);
  }, 0);
  const safetyNeed = need(safety), investingNeed = need(active.filter((g) => !safety.includes(g)));
  const existingSavings = categoryAmount(plan, "savings"), existingInvesting = categoryAmount(plan, "investing");
  const combinedGap = Math.max(0, safetyNeed + investingNeed - existingSavings - existingInvesting);
  const rawSavingsGap = Math.max(0, safetyNeed - existingSavings), rawInvestingGap = Math.max(0, investingNeed - existingInvesting);
  const emergency = active.some((g) => g.type === "emergency_fund");
  // Existing SIP totals may span both kinds of goal. Count their combined capacity only once.
  let savingsGap = emergency ? Math.min(rawSavingsGap, combinedGap) : rawSavingsGap + rawInvestingGap > 0 ? Math.round(combinedGap * rawSavingsGap / (rawSavingsGap + rawInvestingGap)) : 0;
  const investingGap = combinedGap - savingsGap;
  let savings = 0, investing = 0;
  if (emergency && savingsGap > 0) {
    savings = Math.min(future, savingsGap); future -= savings; savingsGap -= savings;
  }
  const gap = savingsGap + investingGap;
  if (gap > 0 && future > 0) {
    const towardGoals = Math.min(future, gap);
    const towardSavings = Math.min(savingsGap, Math.round(towardGoals * savingsGap / gap));
    savings += towardSavings; investing += towardGoals - towardSavings; future -= towardGoals;
  }
  // When dated needs are covered or unknown, this is an editable starting point, not an ideal ratio.
  const extraSavings = Math.round(future * (emergency ? 0.6 : 0.4));
  savings += extraSavings; investing += future - extraSavings;
  return { allocation: { savings, investing, personal }, reasons: [
    "Your confirmed items stay in the plan. Only the money left is allocated here.",
    categoryAmount(plan, "personal") > 0 ? "Your existing personal-spending amount is kept, so no extra is added automatically." : "Personal spending starts at 20% of the money left, not 20% of salary. Change it to suit you.",
    emergency ? (need(safety) > 0 ? "An unfinished emergency goal gives Savings first priority toward its recorded monthly pace." : "Your emergency goal is unfinished but has no monthly pace yet, so Savings starts with a larger share.") : need(active) > 0 ? "Known monthly savings and investing goal gaps guide the future-money allocation." : "No monthly savings/investing goal pace is known. Future money starts at 40% Savings and 60% Investing, ready for you to edit.",
    "Any extra future money uses an editable savings/investing split. No new SIP or payment is created.",
  ] };
}

/** Keep row identities and existing amounts when topping up a previous assisted allocation. */
export function assistedBudget(plan: BudgetSheet, allocation: ExtraAllocation): BudgetSheet | null {
  const values = Object.values(allocation);
  if (values.some((n) => !Number.isSafeInteger(n) || n < 0 || n > 1e9) || values.reduce((a, b) => a + b, 0) > moneyAvailable(plan)) return null;
  const rows = plan.rows.map((r) => ({ ...r }));
  const labels = { savings: "Savings", investing: "Investing", personal: "Guilt-free spending" };
  for (const category of ["savings", "investing", "personal"] as const) {
    const value = allocation[category];
    if (!value) continue;
    const prefix = `assisted-${category}`;
    const existing = rows.find((r) => (r.id === prefix || r.id.startsWith(`${prefix}-`)) && r.category === category && !r.loanId);
    if (existing) { existing.value = rowAmount(existing, plan.salary) + value; existing.mode = "amount"; }
    else {
      const used = new Set(rows.map((r) => r.id)); let id = prefix, suffix = 2;
      while (used.has(id)) id = `${prefix}-${suffix++}`;
      rows.push({ id, name: labels[category], category, mode: "amount", value, loanId: null });
    }
  }
  const result = { ...plan, rows };
  return budgetSheetSchema.safeParse(result).success ? result : null;
}
