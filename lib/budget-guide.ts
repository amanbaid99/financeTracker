import { knownBudgetItems, type KnownBudgetCost } from "./budget-assist";
import { applyBudgetRules, emptyBudgetSheet, isRuleRow, rowAmount, type BudgetSheet, type BudgetSheetRow, type SheetLoan } from "./budget-sheet";

export const COST_QUESTIONS = [
  { id: "housing", name: "Rent or home EMI", question: "Do you pay rent or a home EMI?", hint: "Only add housing costs not already confirmed.", match: /\b(rent|home|housing|mortgage)\b/i },
  { id: "utilities", name: "Utilities", question: "What do utilities cost each month?", hint: "Electricity, water, internet and phone bills.", match: /utilit|electric|internet|broadband|phone|water/i },
  { id: "groceries", name: "Groceries", question: "How much goes toward groceries?", hint: "Use a normal month, not your most expensive one.", match: /grocer|household|food/i },
  { id: "commute", name: "Daily commute", question: "What does getting around cost?", hint: "Your essential commute, fuel or public transport.", match: /commut|transport|fuel|petrol|travel to work/i },
  { id: "insurance", name: "Monthly insurance", question: "Any monthly insurance payments?", hint: "Only payments you make monthly. Annual contributions stay in Goals.", match: /insuran|premium/i },
  { id: "other", name: "Other essentials", question: "Any other regular essentials?", hint: "Family support, subscriptions, school fees or another commitment. Add separate items if helpful.", match: /$^/ },
] as const;
export type GuideCost = { row: BudgetSheetRow; included: boolean; source: string };
export function guideCosts(plan: BudgetSheet, costs: KnownBudgetCost[], loans: SheetLoan[]): GuideCost[] {
  // Savings, investments and discretionary envelopes are not imported into this independent setup.
  const rows = plan.rows.filter(r => !isRuleRow(r) && (r.category === "fixed" || r.category === "variable" || r.category === "debt" || (r.category === "personal" && /commut|transport|fuel/i.test(r.name))));
  const seed = { ...emptyBudgetSheet(plan.salary), rows, excludedLoanIds: plan.excludedLoanIds };
  return knownBudgetItems(seed, costs, loans).map(item => ({ ...item, source: item.row.loanId ? (plan.excludedLoanIds.includes(item.row.loanId) ? "Loan EMI, previously excluded" : "Recorded loan EMI") : item.source, row: { ...item.row, category: item.row.category === "personal" ? "variable" : item.row.category } }));
}
export const expenseTotal = (rows: BudgetSheetRow[], salary: number) => rows.filter(r => r.category !== "savings" && r.category !== "investing" && r.category !== "personal").reduce((s,r) => s+rowAmount(r,salary),0);

/** Editable conscious-spending starting point, not an optimum or an investment recommendation. */
export function recommendBudget(salary: number, rows: BudgetSheetRow[], requestedSpending: number | null) {
  const essentials = expenseTotal(rows,salary);
  const remaining = Math.max(0,salary-essentials);
  const personal = Math.min(remaining,requestedSpending ?? Math.min(Math.round(salary*0.25),Math.round(remaining*0.5)));
  return {
    future: remaining-personal, personal,
    shortfall: Math.max(0,essentials-salary),
    spendingGap: requestedSpending === null ? 0 : Math.max(0,requestedSpending-personal),
    reasons: [
      requestedSpending === null ? "Spending room starts at 25% of income, capped at half the money left after essentials. It is a starting point, not a required ratio." : "Your preferred spending room is reserved first, as far as the remaining income allows.",
      "The rest goes into one Save & invest bucket. You do not need to decide a savings-versus-investing split here.",
      "Annual contributions stay in Goals. This budget does not add a separate yearly provision or link to goals or SIPs.",
    ],
  };
}
export function composeGuidedBudget(salary: number, rows: BudgetSheetRow[], loans: SheetLoan[], future: number): BudgetSheet {
  const includedLoans = new Set(rows.flatMap(r=>r.loanId ? [r.loanId] : []));
  return applyBudgetRules({ version:2,standalone:true,salary,rows:rows.map(r=>({...r})),excludedLoanIds:loans.flatMap(l=>l.id&&!includedLoans.has(l.id)?[l.id]:[]),rules:{savings:{mode:"amount",value:0},investing:{mode:"amount",value:0},future:{mode:"amount",value:future}} });
}
