import { describe, expect, it } from "vitest";
import { composeGuidedBudget, guideCosts, recommendBudget } from "@/lib/budget-guide";
import { budgetSheetSchema, emptyBudgetSheet, rowAmount, sheetTotals, type BudgetSheetRow } from "@/lib/budget-sheet";
const row=(id:string,category:BudgetSheetRow["category"],value:number):BudgetSheetRow=>({id,name:id,category,mode:"amount",value,loanId:null});
describe("guided budget recommendations",()=>{
 it("keeps recorded future allocations out of the independent costs review",()=>{
  const plan={...emptyBudgetSheet(100000),rows:[row("Rent","fixed",30000),row("SIP","investing",20000),row("Savings","savings",10000),row("Guilt-free","personal",10000)]};
  expect(guideCosts(plan,[{id:"r",name:"Rent",amount:35000}],[]).map(i=>i.row.name)).toEqual(["Rent"]);
 });
 it("reserves spending room then recommends saving and investing without asking for ratios",()=>{
  const recommendation=recommendBudget(100000,[row("Rent","fixed",50000)],true,null);
  expect(recommendation).toMatchObject({savings:15000,investing:10000,personal:25000,shortfall:0});
  const plan=composeGuidedBudget(100000,[row("Rent","fixed",50000)],[],recommendation.savings,recommendation.investing);
  expect(sheetTotals(plan).remaining).toBe(0);expect(budgetSheetSchema.safeParse(plan).success).toBe(true);
 });
 it("keeps future allocations affordable when essentials are high",()=>{
  const r=recommendBudget(100000,[row("Essentials","fixed",90000)],true,null);
  expect(r).toMatchObject({savings:3000,investing:2000,personal:5000});
 });
 it("counts annual provision once in savings, not twice as an expense",()=>{
  const rows=[row("Rent","fixed",50000),row("Annual provision","savings",10000)];
  const r=recommendBudget(100000,rows,true,null);expect(r.savings).toBe(22000);expect(r.investing).toBe(8000);expect(r.personal).toBe(20000);
  const plan=composeGuidedBudget(100000,rows,[],r.savings,r.investing);expect(plan.rows.filter(r=>r.category==="savings").reduce((s,r)=>s+rowAmount(r,100000),0)).toBe(22000);expect(sheetTotals(plan).remaining).toBe(0);
 });
 it("honours requested spending where affordable and discloses an unaffordable preference",()=>{
  expect(recommendBudget(100000,[row("Rent","fixed",50000)],false,10000)).toMatchObject({savings:16000,investing:24000,personal:10000,spendingGap:0});
  expect(recommendBudget(100000,[row("Rent","fixed",90000)],true,30000)).toMatchObject({savings:0,investing:0,personal:10000,spendingGap:20000});
 });
 it("never invents disposable income when costs exceed salary",()=>{
  const rows=[row("Essentials","fixed",110000)],r=recommendBudget(100000,rows,true,null);
  expect(r).toMatchObject({savings:0,investing:0,personal:0,shortfall:10000});expect(sheetTotals(composeGuidedBudget(100000,rows,[],0,0)).remaining).toBe(-10000);
 });
 it("preserves excluded loan choices and does not mutate existing costs",()=>{
  const rows=[row("Rent","fixed",30000)],before=structuredClone(rows);const id="00000000-0000-4000-8000-000000000090";
  const p=composeGuidedBudget(100000,rows,[{id,name:"Loan",emi:5000}],20000,20000);expect(p.excludedLoanIds).toEqual([id]);expect(rows).toEqual(before);
 });
});

it("keeps standalone plans stable when a new loan appears in the records",async()=>{
 const {readBudgetSheet}=await import("@/lib/budget-sheet");
 const plan=composeGuidedBudget(100000,[row("Rent","fixed",30000)],[],20000,20000);
 const loaded=readBudgetSheet(plan,100000,[{id:"00000000-0000-4000-8000-000000000090",name:"New loan",emi:10000}]);
 expect(loaded).toEqual(plan);expect(plan.standalone).toBe(true);
});
