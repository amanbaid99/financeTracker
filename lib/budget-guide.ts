import { knownBudgetItems, type KnownBudgetCost } from "./budget-assist";
import { applyBudgetRules, emptyBudgetSheet, isRuleRow, rowAmount, type BudgetSheet, type BudgetSheetRow, type SheetLoan } from "./budget-sheet";

export const COST_QUESTIONS = [
  { id: "housing", name: "Rent or home EMI", question: "Do you pay rent or a home EMI?", hint: "Only add housing costs not already confirmed.", match: /\b(rent|home|housing|mortgage)\b/i },
  { id: "utilities", name: "Utilities", question: "What do utilities cost each month?", hint: "Electricity, water, internet and phone bills.", match: /utilit|electric|internet|broadband|phone|water/i },
  { id: "groceries", name: "Groceries", question: "How much goes toward groceries?", hint: "Use a normal month, not your most expensive one.", match: /grocer|household|food/i },
  { id: "commute", name: "Daily commute", question: "What does getting around cost?", hint: "Your essential commute, fuel or public transport.", match: /commut|transport|fuel|petrol|travel to work/i },
  { id: "insurance", name: "Monthly insurance", question: "Any monthly insurance payments?", hint: "Annual premiums come next. Avoid counting the same payment twice.", match: /insuran|premium/i },
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
export function recommendBudget(salary: number, rows: BudgetSheetRow[], buildingBuffer: boolean, requestedSpending: number | null) {
  const essentials = expenseTotal(rows,salary);
  const provision = rows.filter(r=>r.category === "savings").reduce((s,r)=>s+rowAmount(r,salary),0);
  const remaining = Math.max(0,salary-essentials-provision);
  const personal = Math.min(remaining,requestedSpending ?? Math.min(Math.round(salary*0.25),Math.round(remaining*0.5)));
  const future = remaining-personal;
  const extraSavings = Math.round(future*(buildingBuffer ? 0.6 : 0.4));
  return {
    savings: provision+extraSavings, investing: future-extraSavings, personal,
    shortfall: Math.max(0,essentials+provision-salary),
    spendingGap: requestedSpending === null ? 0 : Math.max(0,requestedSpending-personal),
    reasons: [
      requestedSpending === null ? "Spending room starts at 25% of income, capped at half the money left after essentials and annual provisions. It is a starting point, not a required ratio." : "Your preferred spending room is reserved first, as far as the remaining income allows.",
      buildingBuffer ? "You are building a buffer, so 60% of the remaining future money goes to savings and 40% to investing." : "With a buffer already in place, future money starts at 40% savings and 60% investing.",
      provision > 0 ? "Savings includes the monthly provision for the annual expenses you entered." : "Savings is for a cash buffer and upcoming plans. Investing is for longer-term money.",
      "This uses only the answers here. It does not link to goals, existing SIPs or specific investments.",
    ],
  };
}
export function composeGuidedBudget(salary: number, rows: BudgetSheetRow[], loans: SheetLoan[], savings: number, investing: number): BudgetSheet {
  const includedLoans = new Set(rows.flatMap(r=>r.loanId ? [r.loanId] : []));
  return applyBudgetRules({ version:2,standalone:true,salary,rows:rows.map(r=>({...r})),excludedLoanIds:loans.flatMap(l=>l.id&&!includedLoans.has(l.id)?[l.id]:[]),rules:{savings:{mode:"amount",value:savings},investing:{mode:"amount",value:investing}} });
}
