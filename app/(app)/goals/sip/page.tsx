import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { BudgetSipPlanner } from "@/components/budget-sip-planner";
import { loadMoneyPlan } from "@/lib/data";
import { parseSipMonthly } from "@/lib/budget-sip";
export const metadata:Metadata={title:"Create a SIP plan"};
export default async function BudgetSipPage({searchParams}:{searchParams:Promise<{monthly?:string}>}){
 const [d,params]=await Promise.all([loadMoneyPlan(),searchParams]);
 return <main className="space-y-5"><BackLink fallback="/goals/budget" label="Budget" /><h1 className="text-2xl font-semibold">Create a SIP plan</h1><BudgetSipPlanner initialMonthly={parseSipMonthly(params.monthly)} goals={d.goals} investments={d.investments} links={d.links} today={d.today} lump={d.planInput?.lump??0} essentialsMonthly={d.budget.costs+d.budget.emis} /></main>;
}
