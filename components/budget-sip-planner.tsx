"use client";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoneyInput } from "@/components/money-input";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { saveSipPlan } from "@/lib/sip-minimums-actions";
import { heldSipHoldings, minimumsFit, planWithMinimums, type SipMinimums } from "@/lib/sip-minimums";
import { InvestmentVehicles } from "@/components/investment-vehicles";
import { monthlyVehicles } from "@/lib/investment-plan";
import { formatINR } from "@/lib/format";
import type { Investment,Link as GoalLink,TrackedGoal } from "@/lib/tracker";
export function BudgetSipPlanner({initialMonthly,goals,investments,links,today,lump,essentialsMonthly,initialMinimums={},savedMonthly}:{initialMonthly:number|null;goals:TrackedGoal[];investments:Investment[];links:GoalLink[];today:string;lump:number;essentialsMonthly:number;initialMinimums?:SipMinimums;savedMonthly?:number|null}){
 const [monthly,setMonthly]=useState<number|null>(savedMonthly??initialMonthly),[error,setError]=useState("");const [pending,start]=useTransition();const router=useRouter();
 const types=heldSipHoldings(investments);
 const [minimums,setMinimums]=useState<SipMinimums>(()=>Object.fromEntries(types.map(t=>[t.kind,initialMinimums[t.kind]??0])));
 const valid=monthly!==null&&Number.isSafeInteger(monthly)&&monthly>0&&monthly<=1e9&&(initialMonthly===null||monthly<=initialMonthly);
 const preview=valid?planWithMinimums({goals,investments,links,lump,monthlyTotal:monthly!,todayISO:today,essentialsMonthly},minimums):null;
 const fits=monthly!==null&&minimumsFit(monthly,minimums,investments);
 return <section className="surface-card space-y-4 rounded-2xl border bg-card p-4">
  <p className="text-sm text-muted-foreground">Set your monthly amount. Choose amounts for your holdings below; the rest is planned around your goals.</p>
  {initialMonthly!==null&&<p className="text-sm">Save & invest budget: <b>{formatINR(initialMonthly)}/month</b></p>}
  <Field label="Monthly SIP plan budget" htmlFor="sip-budget" hint="This total includes SIPs already recorded, not just new contributions."><MoneyInput id="sip-budget" value={monthly} onChange={setMonthly} /></Field>
  {initialMonthly!==null&&monthly!==null&&monthly<initialMonthly&&<p className="text-xs text-muted-foreground">{formatINR(initialMonthly-monthly)} stays outside this SIP plan for savings or other allocations.</p>}
  {!valid&&monthly!==null&&<p role="alert" className="text-sm text-danger">Enter a positive whole-rupee amount{initialMonthly!==null?` up to ${formatINR(initialMonthly)}`:" within the supported limit"}.</p>}
  {preview&&<div className="space-y-3 border-t pt-3"><h2 className="font-semibold">Recommended investments</h2>{lump>0&&<p className="text-xs text-muted-foreground">Your existing one-time planning amount of {formatINR(lump)} is kept when working out goal needs.</p>}
    {preview.sipsNow>0&&<p className="text-sm">Existing recorded SIPs: <b>{formatINR(preview.sipsNow)}</b></p>}
    {!fits&&<p role="alert" className="text-sm text-danger">Your minimums and existing SIPs exceed this budget. Reduce a minimum or increase the budget.</p>}
    <InvestmentVehicles rows={monthlyVehicles(preview,investments,links,goals)} />
    {preview.leftoverMonthly>0&&<p className="text-sm">Not allocated to goals: <b>{formatINR(preview.leftoverMonthly)}/month</b>. Keep it aside or add a goal to give it a purpose.</p>}
    {goals.length===0&&<p className="text-sm text-muted-foreground">Add a goal to get a goal-based allocation. You can still save this monthly planning amount.</p>}
    {types.length>0&&<div className="space-y-3 border-t pt-3"><h2 className="font-semibold">Monthly amounts for your holdings</h2><p className="text-xs text-muted-foreground">Choose a minimum for each holding. Zero lets the planner decide. Existing SIPs count toward these amounts.</p><div className="space-y-2">{types.map(t=><Field className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 space-y-0" key={t.kind} label={t.label} htmlFor={`minimum-${t.kind}`}><MoneyInput id={`minimum-${t.kind}`} value={minimums[t.kind]??0} onChange={v=>setMinimums({...minimums,[t.kind]:v??0})}/></Field>)}</div></div>}
    <p className="text-xs text-muted-foreground">Saving keeps your budget and holdings unchanged. Set up contributions with your provider. Custom amounts start supporting goal forecasts once recorded.</p>
    {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
    <Button className="w-full" disabled={pending||!fits} onClick={()=>start(async()=>{setError("");try{const result=await saveSipPlan({lump,monthly:monthly!,minimums});if(!result.ok){setError(result.error);return;}router.push("/goals/plan");router.refresh();}catch{setError("Could not save the SIP plan. Try again.");}})}>{pending?"Saving…":"Create plan"}</Button>
  </div>}
 </section>;
}
