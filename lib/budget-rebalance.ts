import { applyBudgetRules, isRuleRow, rowAmount, type BudgetSheet } from "./budget-sheet";
const named = (p: BudgetSheet) => p.rows.filter(r => !isRuleRow(r) && r.id !== "setup-personal");
const costs = (p: BudgetSheet) => JSON.stringify(named(p).filter(r => r.category !== "savings" && r.category !== "investing"));
/** Income and cost edits keep the user's personal amount; saving gets the remainder.
 * Explicit personal/saving edits retain their existing dedicated form behaviour. */
export function rebalanceBudgetEdit(previous: BudgetSheet, next: BudgetSheet): BudgetSheet {
  if (previous.salary === next.salary && !!previous.noSalary === !!next.noSalary && costs(previous) === costs(next)) return applyBudgetRules(next);
  const prior = applyBudgetRules(previous);
  const personal = prior.rows.filter(r=>r.category==="personal").reduce((s,r)=>s+rowAmount(r,prior.salary),0);
  const oldNamed = named(previous).filter(r=>r.category==="personal").reduce((s,r)=>s+rowAmount(r,previous.salary),0);
  const rows = named(next);
  const newNamed = rows.filter(r=>r.category==="personal").reduce((s,r)=>s+rowAmount(r,next.salary),0);
  const targetPersonal = Math.max(newNamed, personal + newNamed - oldNamed);
  if(targetPersonal > newNamed) rows.push({id:"setup-personal",name:"Personal spending",category:"personal",mode:"amount",value:targetPersonal-newNamed,loanId:null});
  const fixed = rows.filter(r=>!["savings","investing","personal"].includes(r.category)).reduce((s,r)=>s+rowAmount(r,next.salary),0);
  return applyBudgetRules({...next,rows,rules:{savings:{mode:"amount",value:0},investing:{mode:"amount",value:0},future:{mode:"amount",value:next.noSalary?0:Math.max(0,next.salary-fixed-targetPersonal)}}});
}
