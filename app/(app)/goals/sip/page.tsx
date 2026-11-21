import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { BudgetSipPlanner } from "@/components/budget-sip-planner";
import { loadBudgetSheet } from "@/lib/budget-ratio-data";
import { applyBudgetRules,rowAmount } from "@/lib/budget-sheet";
import { loadBudget,loadMoneyPlan } from "@/lib/data";
import { parseSipMonthly } from "@/lib/budget-sip";
export const metadata:Metadata={title:"Create a SIP plan"};
export default async function BudgetSipPage({searchParams}:{searchParams:Promise<{monthly?:string}>}){
 const [d,b,params]=await Promise.all([loadMoneyPlan(),loadBudget(),searchParams]);
 let initialMonthly=parseSipMonthly(params.monthly);
 if(initialMonthly===null){
  const sheet=await loadBudgetSheet(b.recordIncome,b.loanEmis);
  if(sheet.saved&&sheet.plan){const plan=applyBudgetRules(sheet.plan);const amount=plan.rows.filter(r=>r.category==="savings"||r.category==="investing").reduce((sum,r)=>sum+rowAmount(r,plan.salary),0);initialMonthly=amount>0&&amount<=1e9?amount:null;}
 }

 return <main className="space-y-5"><BackLink fallback="/goals/budget" label="Budget" /><h1 className="text-2xl font-semibold">Create a SIP plan</h1><BudgetSipPlanner initialMonthly={initialMonthly} goals={d.goals} investments={d.investments} links={d.links} today={d.today} lump={d.planInput?.lump??0} essentialsMonthly={d.budget.costs+d.budget.emis} /></main>;
}
