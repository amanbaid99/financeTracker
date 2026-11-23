"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {Sheet} from "./sheet";
import {Button,buttonVariants} from "./ui/button";
import {Select} from "./ui/input";
import {Field} from "./forms/field";
import {MoneyInput} from "./money-input";
import {unallocatedHoldings,assignmentRows} from "@/lib/unallocated";
import {holdingLabel} from "@/lib/goal-suggestions";
import {formatINR} from "@/lib/format";
import {saveGoalMapping} from "@/lib/goal-suggestion-actions";
import {withdrawalEligible} from "@/lib/withdrawal-plan";
import type {Investment,Link as GoalLink,TrackedGoal} from "@/lib/tracker";

export function UnallocatedMoney({investments,links,goals,today}:{investments:Investment[];links:GoalLink[];goals:TrackedGoal[];today:string}){
 const rows=unallocatedHoldings(investments,links);
 const [selected,setSelected]=useState<string|null>(null);
 if(!rows.length)return null;
 const canAssign=links.length===0||goals.some(g=>g.confirmedMapping);
 const current=rows.find(r=>r.investment.id===selected);
 return <section aria-labelledby="unallocated-h" className="surface-card space-y-3 rounded-2xl border bg-card p-4">
  <div><h2 id="unallocated-h" className="font-semibold">Money not assigned to goals</h2><p className="tabular mt-1 text-2xl font-semibold">{formatINR(rows.reduce((s,r)=>s+r.value,0))}</p></div>
  <p className="text-sm text-muted-foreground">These parts of your holdings don&apos;t currently cover a goal. Unassigned doesn&apos;t mean available to withdraw.</p>
  {!canAssign&&<p className="text-xs text-muted-foreground">Confirm your existing goal coverage in the monthly plan before assigning more money. This keeps other goals covered.</p>}
  <ul className="divide-y">{rows.map(r=>{const i=r.investment;const accessible=(!i.availability||i.availability==="available")&&(!i.accessibleOn||i.accessibleOn<=today);const canWithdraw=accessible&&withdrawalEligible(i);return <li key={i.id} className="space-y-2 py-3">
   <div className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words font-medium">{holdingLabel(i)}</span><b className="tabular shrink-0">{formatINR(r.value)}</b></div>
   <p className="text-xs text-muted-foreground">{r.freePercent}% unassigned · Holding total {formatINR(i.value)}{!accessible?" · Access restricted":""}</p>
   <div className="flex flex-wrap gap-2">{canAssign?<Button variant="outline" size="sm" onClick={()=>setSelected(i.id)}>Assign to a goal</Button>:<Link href="/goals/sip" className={buttonVariants({variant:"outline",size:"sm"})}>Review goal coverage first</Link>}
    {canWithdraw?<Link className={buttonVariants({variant:"ghost",size:"sm"})} href={`/assets/withdraw?holding=${i.id}&amount=${Math.min(1e9,r.value)}`}>Plan a withdrawal</Link>:<span className="self-center text-xs text-muted-foreground">Withdrawal access needs checking</span>}
   </div>
  </li>;})}</ul>
  {current&&<AssignSheet key={current.investment.id} investment={current.investment} available={current.value} links={links} goals={goals} onClose={()=>setSelected(null)}/>}
 </section>;
}
function AssignSheet({investment,available,links,goals,onClose}:{investment:Investment;available:number;links:GoalLink[];goals:TrackedGoal[];onClose:()=>void}){
 const router=useRouter();const [goalId,setGoalId]=useState("");const [amount,setAmount]=useState<number|null>(available);const [error,setError]=useState("");const [pending,start]=useTransition();
 const active=goals.filter(g=>!g.completed&&g.status!=="reached");
 let preview:ReturnType<typeof assignmentRows>|null=null;
 try{if(goalId&&amount!==null)preview=assignmentRows(links,goalId,investment,amount);}catch{}
 return <Sheet title="Assign money to a goal" onClose={()=>!pending&&onClose()}>
  <form className="space-y-4" onSubmit={e=>{e.preventDefault();if(!preview)return;const rows=preview.rows;start(async()=>{setError("");try{const result=await saveGoalMapping({goalId,rows});if(!result.ok)return setError(result.error);onClose();router.refresh();}catch{setError("Connection interrupted. Refresh to check your coverage before retrying.");}});}}>
   <p className="text-sm">{holdingLabel(investment)} · {formatINR(available)} unassigned</p>
   <Field label="Goal" htmlFor="assign-goal"><Select id="assign-goal" value={goalId} onChange={e=>setGoalId(e.target.value)}><option value="">Choose a goal</option>{active.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</Select></Field>
   {!active.length&&<Link href="/goals/new" className="inline-flex min-h-11 items-center text-sm text-primary">Create a goal first</Link>}
   <Field label="Amount to assign" htmlFor="assign-amount"><MoneyInput id="assign-amount" value={amount} onChange={setAmount}/></Field>
   {preview&&<p className="rounded-xl bg-muted/50 p-3 text-sm">Assign {formatINR(preview.assigned)} to {active.find(g=>g.id===goalId)?.name}. {formatINR(available-preview.assigned)} stays unassigned. Shares are stored to two decimal places.</p>}
   {goalId&&!preview&&<p role="alert" className="text-sm text-danger">Enter an amount within the unassigned value. Very small amounts may be below the supported share precision.</p>}
   <p className="text-xs text-muted-foreground">This changes goal coverage only. It does not move money, start a SIP or make this holding suitable for the goal. Other goals keep their shares.</p>
   {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
   <Button className="w-full" disabled={!preview||pending}>{pending?"Saving…":"Confirm allocation"}</Button>
  </form>
 </Sheet>;
}
