import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { WithdrawalPlanner } from "@/components/withdrawal-planner";
import { loadGoals } from "@/lib/data";
export const metadata:Metadata={title:"Plan a withdrawal"};
export default async function WithdrawalPage(){
 const {goals,investments,today}=await loadGoals();
 return <main className="space-y-4"><BackLink fallback="/assets" label="Net worth"/><h1 className="text-2xl font-semibold">Plan a withdrawal</h1><WithdrawalPlanner goals={goals} investments={investments} today={today}/></main>;
}
