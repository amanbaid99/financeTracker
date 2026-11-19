"use client";
import { useState,useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoneyInput } from "@/components/money-input";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { savePlan } from "@/lib/actions";
import { planMoney } from "@/lib/allocate";
import { formatINR } from "@/lib/format";
import type { Investment,Link as GoalLink,TrackedGoal } from "@/lib/tracker";
export function BudgetSipPlanner({initialMonthly,goals,investments,links,today,lump,essentialsMonthly}:{initialMonthly:number|null;goals:TrackedGoal[];investments:Investment[];links:GoalLink[];today:string;lump:number;essentialsMonthly:number}){
 const [monthly,setMonthly]=useState<number|null>(initialMonthly),[error,setError]=useState("");const [pending,start]=useTransition();const router=useRouter();
 const valid=monthly!==null&&Number.isSafeInteger(monthly)&&monthly>0&&monthly<=1e9&&(initialMonthly===null||monthly<=initialMonthly);
 const preview=valid?planMoney({goals,investments,links,lump,monthlyTotal:monthly!,todayISO:today,essentialsMonthly}):null;
 const short=preview?Math.max(0,preview.sipsNow-preview.monthlyTotal):0;
 return <section className="surface-card space-y-4 rounded-2xl border bg-card p-4">
  <p className="text-sm text-muted-foreground">Start with your Save & invest amount. Keep any near-term savings accessible and use only the part you want in this monthly SIP plan. Your budget stays unchanged.</p>
  {initialMonthly!==null&&<p className="text-sm">Save & invest budget: <b>{formatINR(initialMonthly)}/month</b></p>}
  <Field label="Monthly SIP plan budget" htmlFor="sip-budget" hint="This total includes SIPs already recorded, not just new contributions."><MoneyInput id="sip-budget" value={monthly} onChange={setMonthly} /></Field>
  {initialMonthly!==null&&monthly!==null&&monthly<initialMonthly&&<p className="text-xs text-muted-foreground">{formatINR(initialMonthly-monthly)} stays outside this SIP plan for savings or other allocations.</p>}
  {!valid&&monthly!==null&&<p role="alert" className="text-sm text-danger">Enter a positive whole-rupee amount{initialMonthly!==null?` up to ${formatINR(initialMonthly)}`:" within the supported limit"}.</p>}
  {preview&&<div className="space-y-3 border-t pt-3"><h2 className="font-semibold">Review the monthly allocation</h2>{lump>0&&<p className="text-xs text-muted-foreground">Your existing one-time planning amount of {formatINR(lump)} is kept when working out goal needs.</p>}
    {preview.sipsNow>0&&<p className="text-sm">Existing recorded SIPs: <b>{formatINR(preview.sipsNow)}</b></p>}
    {short>0&&<p role="alert" className="text-sm text-danger">Recorded SIPs exceed this budget by {formatINR(short)}. Increase the budget or review recorded SIPs before saving.</p>}
    <ul className="divide-y">{preview.suggestions.filter(s=>s.monthly>0).map(s=><li key={s.goalId} className="space-y-1 py-3"><div className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words">{s.goalName}</span><b className="tabular shrink-0">{formatINR(s.monthly)}/mo</b></div><p className="text-xs text-muted-foreground">{s.categoryLabel} · {s.why}</p></li>)}</ul>
    {preview.leftoverMonthly>0&&<p className="text-sm">Not allocated to goals: <b>{formatINR(preview.leftoverMonthly)}/month</b>. Keep it aside or add a goal to give it a purpose.</p>}
    {goals.length===0&&<p className="text-sm text-muted-foreground">Add a goal to get a goal-based allocation. You can still save this monthly planning amount.</p>}
    <Link href="/goals" className="inline-flex min-h-10 items-center text-sm text-primary">Review goals</Link>
    <p className="text-xs text-muted-foreground">Existing SIPs are counted once. Saving sets the monthly amount for Your plan and keeps any existing one-time planning amount. It does not create SIP mandates, place orders or update investment records.</p>
    {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
    <Button className="w-full" disabled={pending||short>0} onClick={()=>start(async()=>{setError("");try{const result=await savePlan({lump,monthly:monthly!});if(!result.ok){setError(result.error);return;}router.push("/goals/plan");router.refresh();}catch{setError("Could not save the SIP plan. Try again.");}})}>{pending?"Saving…":"Save SIP plan"}</Button>
  </div>}
 </section>;
}
