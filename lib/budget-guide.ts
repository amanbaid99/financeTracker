import {formatINR} from "./format";
// The budget setup: income (or none right now), one list of monthly costs
// prefilled from your records, then a suggested split to review. Pure; the
// component saves only when you tap Save.

import { isPersonalTransport, personalMinimum } from "./personal-budget";
import { knownBudgetItems, type KnownBudgetCost } from "./budget-assist";
import { applyBudgetRules, emptyBudgetSheet, isRuleRow, rowAmount, type BudgetSheet, type BudgetSheetRow, type SheetLoan } from "./budget-sheet";

/** Everyday and fun money: counted inside Personal spending, not Essentials. */
const PERSONAL = /day[ -]*to[ -]*day|everyday|daily (spend|expense)|transport|commut|fuel|petrol|personal|guilt[ -]*free|eating out|shopping|entertainment|fun/i;
export const isPersonalCost = (row: Pick<BudgetSheetRow, "name" | "loanId">) => !row.loanId && PERSONAL.test(row.name);

export type GuideCost = { row: BudgetSheetRow; included: boolean; source: string };

/** Every recorded cost and loan EMI, ready to confirm. Savings rows aren't costs. */
export function guideCosts(plan: BudgetSheet, costs: KnownBudgetCost[], loans: SheetLoan[]): GuideCost[] {
  const rows = plan.rows.filter(r => !isRuleRow(r) && r.category !== "savings" && r.category !== "investing");
  const seed = { ...emptyBudgetSheet(plan.salary), rows, excludedLoanIds: plan.excludedLoanIds };
  // These old record categories belong in the user's single Personal amount.
  // Keep explicitly saved draft rows, but never add these records to new setup.
  const autoCosts=costs.filter(c=>!/^(day[\s-]*to[\s-]*day spending|transport|daily commute)$/i.test(c.name.trim()));
  return knownBudgetItems(seed, autoCosts, loans).filter(i => i.row.category !== "savings" && i.row.category !== "investing").map(item => ({
    included: item.included,
    source: item.row.loanId ? "Loan EMI" : item.source.startsWith("Current") ? "In your budget" : "From your records",
    row: { ...item.row, mode: "amount" as const, value: rowAmount(item.row, plan.salary), category: isPersonalCost(item.row) || isPersonalTransport(item.row) ? "personal" : item.row.category === "personal" ? "personal" : "fixed" },
  }));
}

export const expenseTotal = (rows: BudgetSheetRow[], salary: number) => rows.filter(r => r.category !== "savings" && r.category !== "investing" && r.category !== "personal").reduce((s,r) => s+rowAmount(r,salary),0);
export const costTotal = (rows: BudgetSheetRow[], salary: number) => rows.filter(r => r.category !== "savings" && r.category !== "investing").reduce((s,r) => s+rowAmount(r,salary),0);

const STEP = 500;

/**
 * A starting split, not advice: Personal spending gets 25% of income (at most
 * half of what's left after essentials, never less than your named personal
 * costs). Save & invest is the rest, rounded down to ₹500, and never less than
 * the SIPs already going in when they fit. Personal spending takes the rounding.
 */
export function recommendBudget(salary: number, rows: BudgetSheetRow[], sips = 0) {
  const essentials = expenseTotal(rows, salary);
  const named = personalMinimum(rows, salary);
  const room = Math.max(0, salary - essentials);
  const personalTarget = Math.min(room, Math.max(named, Math.min(Math.round(salary * 0.25), Math.round(room * 0.5))));
  const canSave = Math.max(0, room - named);
  let future = Math.floor((room - personalTarget) / STEP) * STEP;
  if (sips > 0) future = Math.max(future, Math.min(sips, canSave));
  return {
    essentials,
    future,
    personal: room - future,
    shortfall: Math.max(0, essentials + named - salary),
    reasons: [
      "Personal spending starts at a quarter of your income, at most half of what's left after essentials. It's a starting point; change it to suit you.",
      sips > 0 ? "Save & invest includes the SIPs you already have, so it isn't counted twice." : "Save & invest is the rest, rounded to the nearest ₹500.",
    ],
  };
}

export function composeGuidedBudget(salary: number, rows: BudgetSheetRow[], loans: SheetLoan[], future: number, noSalary = false): BudgetSheet {
  const includedLoans = new Set(rows.flatMap(r=>r.loanId ? [r.loanId] : []));
  return applyBudgetRules({
    version: 2, standalone: true, personalGrouping: true,
    salary: noSalary ? 0 : salary,
    ...(noSalary ? { noSalary: true } : {}),
    rows: rows.map(r=>({...r})),
    excludedLoanIds: loans.flatMap(l=>l.id&&!includedLoans.has(l.id)?[l.id]:[]),
    rules: { savings:{mode:"amount",value:0}, investing:{mode:"amount",value:0}, future:{mode:"amount",value: noSalary ? 0 : future} },
  });
}

/** User chooses Personal; every remaining rupee goes to Save & invest. */
export function personalBudget(salary:number,rows:BudgetSheetRow[],personal:number){
 const essentials=expenseTotal(rows,salary),minimum=personalMinimum(rows,salary);
 const room=Math.max(0,salary-essentials);
 const valid=Number.isSafeInteger(personal)&&personal>=minimum&&personal<=room&&essentials<=salary;
 const error=personal<minimum?`Your listed personal costs already total ${formatINR(minimum)}. Keep at least that amount, or go back and change those costs.`:essentials+personal>salary?`Essentials and personal spending exceed your income by ${formatINR(essentials+personal-salary)}. Lower personal spending or change your costs.`:"Enter a non-negative whole-rupee amount.";
 return {future:Math.max(0,room-personal),valid,error:valid?null:error};
}

/** Blank prompts for common fixed costs, never invented spending amounts. */
export function budgetSetupCosts(plan:BudgetSheet,costs:KnownBudgetCost[],loans:SheetLoan[]):GuideCost[]{
 const items=guideCosts(plan,costs,loans).filter(i=>i.row.id!=="setup-personal");
 for(const name of ["Rent","Utilities"]){
  const match=name==="Rent"?/\brent\b/i:/\butilit(?:y|ies)\b/i;
  if(!items.some(i=>!i.row.loanId&&match.test(i.row.name)))items.push({row:{id:`prompt-${name.toLowerCase()}`,name,category:"fixed",mode:"amount",value:0,loanId:null},included:true,source:"Optional"});
 }
 return items;
}
