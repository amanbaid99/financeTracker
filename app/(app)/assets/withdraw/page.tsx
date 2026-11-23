import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { WithdrawalPlanner } from "@/components/withdrawal-planner";
import { loadGoals } from "@/lib/data";
export const metadata:Metadata={title:"Plan a withdrawal"};
export default async function WithdrawalPage({searchParams}:{searchParams:Promise<{holding?:string;amount?:string}>}){
 const [{goals,investments,today},params]=await Promise.all([loadGoals(),searchParams]);
 const initialHolding=investments.some(i=>i.id===params.holding)?params.holding!:null;
 const amount=Number(params.amount);
 const initialAmount=Number.isSafeInteger(amount)&&amount>0&&amount<=1e9?amount:null;
 return <main className="space-y-4"><BackLink fallback="/assets" label="Net worth"/><h1 className="text-2xl font-semibold">Plan a withdrawal</h1><WithdrawalPlanner goals={goals} investments={investments} today={today} initialAmount={initialAmount} initialHolding={initialHolding}/></main>;
}
