import { describe, expect, it } from "vitest";
import { composeGuidedBudget, guideCosts, recommendBudget } from "@/lib/budget-guide";
import { applyBudgetRules, budgetRuleGaps, budgetSheetSchema, emptyBudgetSheet, readBudgetSheet, rowAmount, sheetTotals, type BudgetSheetRow } from "@/lib/budget-sheet";
const row=(id:string,category:BudgetSheetRow["category"],value:number):BudgetSheetRow=>({id,name:id,category,mode:"amount",value,loanId:null});
describe("three-bucket guided budget",()=>{
 it("keeps existing future allocations and annual provisions out of the costs review",()=>{
  const plan={...emptyBudgetSheet(100000),rows:[row("Rent","fixed",30000),row("SIP","investing",20000),row("guide-annual","savings",10000),row("Guilt-free","personal",10000)]};
  expect(guideCosts(plan,[{id:"r",name:"Rent",amount:35000}],[]).map(i=>i.row.name)).toEqual(["Rent"]);
 });
 it("recommends one future amount and accounts for every rupee",()=>{
  const r=recommendBudget(100000,[row("Rent","fixed",50000)],null);
  expect(r).toMatchObject({future:25000,personal:25000,shortfall:0});
  const p=composeGuidedBudget(100000,[row("Rent","fixed",50000)],[],r.future);
  expect(sheetTotals(p).remaining).toBe(0);expect(budgetSheetSchema.safeParse(p).success).toBe(true);
  expect(p.rules?.future?.value).toBe(25000);expect(p.rows.some(r=>r.id==="guide-annual")).toBe(false);
 });
 it("keeps the recommendation affordable with high essentials or preferred spending",()=>{
  expect(recommendBudget(100000,[row("Costs","fixed",90000)],null)).toMatchObject({future:5000,personal:5000});
  expect(recommendBudget(100000,[row("Costs","fixed",50000)],10000)).toMatchObject({future:40000,personal:10000});
  expect(recommendBudget(100000,[row("Costs","fixed",90000)],30000)).toMatchObject({future:0,personal:10000,spendingGap:20000});
 });
 it("never invents money when costs exceed income",()=>{
  const rows=[row("Costs","fixed",110000)],r=recommendBudget(100000,rows,null);
  expect(r).toMatchObject({future:0,personal:0,shortfall:10000});expect(sheetTotals(composeGuidedBudget(100000,rows,[],0)).remaining).toBe(-10000);
 });
 it("preserves legacy named saving and investing items when a combined target is chosen",()=>{
  const p=composeGuidedBudget(100000,[row("Cash buffer","savings",10000),row("Existing investment","investing",15000)],[],40000);
  expect(p.rows.filter(r=>r.category==="savings"||r.category==="investing").reduce((s,r)=>s+rowAmount(r,p.salary),0)).toBe(40000);
  expect(p.rows.find(r=>r.id==="rule-personal")?.value).toBe(60000);expect(applyBudgetRules(p)).toEqual(p);
  expect(budgetRuleGaps({...p,rules:{...p.rules!,future:{mode:"amount",value:20000}}})).toEqual([{category:"savings",excess:5000}]);
 });
 it("gives deleted costs to spending without increasing the combined target",()=>{
  const p=composeGuidedBudget(100000,[row("Rent","fixed",50000)],[],30000);
  const next=applyBudgetRules({...p,rows:p.rows.filter(r=>r.id!=="Rent")});
  expect(next.rules?.future?.value).toBe(30000);expect(next.rows.find(r=>r.id==="rule-personal")?.value).toBe(70000);
 });
 it("remembers excluded loans and does not auto-insert new ones on read",()=>{
  const id="00000000-0000-4000-8000-000000000090";
  const p=composeGuidedBudget(100000,[],[{id,name:"Loan",emi:5000}],30000);expect(p.excludedLoanIds).toEqual([id]);
  expect(readBudgetSheet(p,100000,[{id,name:"Loan",emi:5000}])).toEqual(p);
 });
});
