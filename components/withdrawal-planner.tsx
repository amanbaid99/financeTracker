"use client";
import { useState } from "react";
import Link from "next/link";
import { MoneyInput } from "@/components/money-input";
import { Field } from "@/components/forms/field";
import { Select } from "@/components/ui/input";
import { formatINR } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import { planWithdrawal } from "@/lib/withdrawal-plan";
import type { Investment,TrackedGoal } from "@/lib/tracker";
export function WithdrawalPlanner({goals,investments,today}:{goals:TrackedGoal[];investments:Investment[];today:string}){
 const [amount,setAmount]=useState<number|null>(null),[goalId,setGoalId]=useState(""),[allowOther,setAllowOther]=useState(false);
 const valid=amount!==null&&Number.isSafeInteger(amount)&&amount>0&&amount<=1e9;
 const plan=valid?planWithdrawal({amount,goalId:goalId||null,allowOtherGoals:allowOther,goals,investments,today}):null;
 return <section className="surface-card space-y-4 rounded-2xl border bg-card p-4"><p className="text-sm text-muted-foreground">Preview where money could come from and what it would mean for your goals. Nothing is withdrawn or saved.</p>
 <Field label="Amount needed" htmlFor="withdraw-amount"><MoneyInput id="withdraw-amount" value={amount} onChange={setAmount}/></Field>
 <Field label="What is it for?" htmlFor="withdraw-goal"><Select id="withdraw-goal" value={goalId} onChange={e=>{setGoalId(e.target.value);setAllowOther(false);}}><option value="">Something else</option>{goals.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</Select></Field>
 <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={allowOther} onChange={e=>setAllowOther(e.target.checked)}/>Also consider money covering other goals</label>
 <p className="text-xs text-muted-foreground">Money covering your selected goal first, then unassigned money. Emergency and bill reserves stay protected unless you select that goal.</p>
 {amount!==null&&!valid&&<p role="alert" className="text-sm text-danger">Enter a positive whole-rupee amount up to {formatINR(1e9)}.</p>}
 {plan&&<div className="space-y-3 border-t pt-3" aria-live="polite"><h2 className="font-semibold">Withdrawal preview</h2><ul className="divide-y">{plan.lines.map((line,n)=>{const inv=investments.find(i=>i.id===line.investmentId)!;return <li key={`${line.investmentId}:${n}`} className="space-y-1 py-3"><div className="flex flex-wrap justify-between gap-2 text-sm"><b className="min-w-0 break-words">{inv.name||categoryLabel(inv.category)}</b><b className="tabular">{formatINR(line.amount)}</b></div><p className="text-xs text-muted-foreground">{line.reason==="unassigned"?"Not needed by a goal today":line.reason==="selected_goal"?"Currently covering your selected goal":"Currently covering other goals"} · {formatINR(line.remaining)} left in this holding</p></li>;})}</ul>
 <p className="text-sm">Available in this preview: <b>{formatINR(plan.available)}</b></p>{plan.short>0&&<p role="alert" className="text-sm text-warning">{formatINR(plan.short)} still needed. Some money is reserved for goals or excluded because access is not confirmed.</p>}
 {plan.impacts.some(i=>goals.some(g=>g.id===i.goalId&&["emergency_fund","bills_fund"].includes(g.type)))&&<p role="alert" className="text-sm text-warning">This preview increases a shortfall in your emergency or bill reserves. Review the effect on goals before withdrawing.</p>}
 <details><summary className="min-h-10 cursor-pointer text-sm font-medium">Effect on goals</summary><p className="text-xs text-muted-foreground">Compares the lower balances with your current targets unchanged. Completing a goal is a separate update. Shortfalls are estimates at each goal’s date.</p>{plan.impacts.length?<ul className="space-y-2 pt-2">{plan.impacts.map(i=><li key={i.goalId} className="text-sm">{goals.find(g=>g.id===i.goalId)?.name}: {formatINR(i.extraShortfall)} more to fund</li>)}</ul>:<p className="text-sm">No additional funding shortfall in the current goal model.</p>}</details>
 <p className="text-xs text-muted-foreground">Uses recorded balances, not live redemption values. Tax, exit loads, units, settlement times and purchase-lot restrictions are not calculated. Confirm access with your provider. ELSS, retirement accounts, FDs, physical gold and unknown assets are excluded.</p>
 <Link href="/assets?do=update" className="inline-flex min-h-11 items-center text-sm text-primary">Update balances after withdrawing</Link>
 </div>}</section>;
}
