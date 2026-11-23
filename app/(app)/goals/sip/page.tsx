import {sameGoalMapping} from "@/lib/hybrid-mapping";
import {loadHybridContext} from "@/lib/hybrid-data";
import {HYBRID_VERSION} from "@/lib/hybrid-engine";
import {snapshotCompatible} from "@/lib/hybrid-plan";
import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { SimpleSipPlanner } from "@/components/simple-sip-planner";
import { loadBudgetSheet } from "@/lib/budget-ratio-data";
import { applyBudgetRules,rowAmount } from "@/lib/budget-sheet";
import { loadBudget,loadMoneyPlan } from "@/lib/data";
import { loadSipMinimums } from "@/lib/sip-minimums-data";
import { parseSipMonthly } from "@/lib/budget-sip";
export const metadata:Metadata={title:"Create a SIP plan"};
export default async function BudgetSipPage({searchParams}:{searchParams:Promise<{monthly?:string}>}){
 const [d,b,params,minimums,c]=await Promise.all([loadMoneyPlan(),loadBudget(),searchParams,loadSipMinimums(),loadHybridContext()]);
 const latest=c.plans[0],confirmed=latest&&snapshotCompatible(latest.result)?{createdAt:latest.created_at,result:latest.result,inputs:latest.inputs,stale:latest.input_revision!==c.sourceRevision||latest.result.calculatedOn!==d.today||latest.engine_version!==HYBRID_VERSION||!sameGoalMapping(latest.result.links,d.links)}:null;
 let initialMonthly=parseSipMonthly(params.monthly);
 // Fixed costs and EMIs: the budget's Essentials, or recorded costs before a budget exists.
 const saved=await loadBudgetSheet(b.recordIncome,b.loanEmis);
 const essentials=saved.saved&&saved.plan?saved.plan.rows.filter(r=>!["personal","savings","investing"].includes(r.category)).reduce((sum,r)=>sum+rowAmount(r,saved.plan!.salary),0):b.budget.costs+b.budget.emis;
 if(initialMonthly===null){
  const sheet=await loadBudgetSheet(b.recordIncome,b.loanEmis);
  if(sheet.saved&&sheet.plan){const plan=applyBudgetRules(sheet.plan);const amount=plan.rows.filter(r=>r.category==="savings"||r.category==="investing").reduce((sum,r)=>sum+rowAmount(r,plan.salary),0);initialMonthly=amount>0&&amount<=1e9?amount:null;}
 }

 return <main className="space-y-5"><BackLink fallback="/goals/budget" label="Budget" /><div className="space-y-1"><h1 className="text-2xl font-semibold">Your monthly SIPs</h1><p className="text-sm text-muted-foreground">Every holding, with what we&apos;d suggest putting in each month. Change any amount, then save.</p></div><SimpleSipPlanner goals={d.goals} investments={d.investments} links={d.links} today={d.today} budgetMonthly={initialMonthly??0} essentialsMonthly={essentials} savedAmounts={confirmed?minimums:{}} hasConfirmed={!!confirmed} revision={c.revision} riskTolerance={c.riskTolerance} /></main>;
}
