"use client";
import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/sheet";
import { SheetActions } from "@/components/forms/sheet-actions";
import { formatINR } from "@/lib/format";
import { CompactAllocation } from "@/components/allocation-bar";
import { ASSET_CLASSES } from "@/lib/portfolio";
import { SipSplitSheet } from "./sip-split-sheet";
import { goalVehicleAmounts, vehicleSplit, withGoalVehicleAmounts } from "@/lib/sip-vehicle-split";
import { sipMix, sipStatus, sipEditComparison, sipsByGoal, type SipRow } from "@/lib/budget-sips";
import { cn } from "@/lib/utils";
type GoalOption={id:string;label:string;requiredMonthly?:number|null;vehicles?:{id:string;label:string;assetClass:string}[]};
export function BudgetSips({rows,budgetMonthly,goals,pending,error,onSave,included=true,onInclude}:{rows:SipRow[];budgetMonthly:number|null;goals:GoalOption[];pending:boolean;error:string;onSave:(rows:SipRow[],note:string)=>void;included?:boolean;onInclude?:(included:boolean)=>void}){
  const saved=sipsByGoal(rows);
  const start=()=>Object.fromEntries(goals.map(g=>[g.id,saved.get(g.id)??null]));
  const [editing,setEditing]=useState(false);
  const [splitGoal,setSplitGoal]=useState<string|null>(null);
  const revision=JSON.stringify(rows);
  const [editRevision,setEditRevision]=useState(revision);
  const isEditing=editing && editRevision===revision;
  const [amounts,setAmounts]=useState<Record<string,number|null>>(start);
  const values=isEditing?amounts:start();
  const draft:SipRow[]=goals.filter(g=>(values[g.id]??0)>0).map(g=>{
    const total=values[g.id]??0,eligible=new Set((g.vehicles??[]).map(v=>v.id));
    const pins=Object.fromEntries(Object.entries(goalVehicleAmounts(rows,g.id,total)).filter(([id])=>eligible.has(id)));
    return {id:`goal-${g.id}`,investmentId:null,label:g.label.slice(0,80),amount:total,goalId:g.id,...(Object.keys(pins).length?{vehicleAmounts:pins}:{})};
  });
  const comparison=sipEditComparison(draft,budgetMonthly,rows.filter(r=>goals.some(g=>g.id===r.goalId)));
  const savedStatus=sipStatus(rows.filter(r=>goals.some(g=>g.id===r.goalId)),budgetMonthly);
  const changed=goals.some(g=>(amounts[g.id]??0)!==(saved.get(g.id)??0));
  const resolved=(g:GoalOption,total:number)=>vehicleSplit(total,(g.vehicles??[]).map((v,i)=>v.id??String(i)),goalVehicleAmounts(rows,g.id,total));
  const mix=sipMix(goals.map(g=>{const total=saved.get(g.id)??0,split=resolved(g,total);return {amount:total,classes:split.error?[]:(g.vehicles??[]).map(v=>v.assetClass),allocations:split.error||!g.vehicles?.length?undefined:g.vehicles.map((v,i)=>split.amounts[v.id??String(i)]??0)};}));
  const selected=goals.find(g=>g.id===splitGoal);
  const isSplitOpen=!!selected && !isEditing && editRevision===revision;

  const cancel=()=>{if(pending)return;setAmounts(start());setEditing(false);};
  const summary=(status:ReturnType<typeof sipStatus>)=><div aria-live="polite" className="space-y-1">
    <p className="tabular text-sm font-semibold">{formatINR(status.assigned)}{budgetMonthly!==null?` of ${formatINR(budgetMonthly)}`:""} allocated / month</p>
    {budgetMonthly!==null&&<p className={cn("text-sm",status.over>0?"text-danger":status.left>0?"text-warning":"text-success")}>{status.over>0?`${formatINR(status.over)} over budget`:status.left>0?`${formatINR(status.left)} remaining to allocate`:"All saving allocated"}</p>}
  </div>;
  const editSummary=<div role="status" aria-live="polite" aria-atomic="true" className="sticky top-0 z-10 -mx-1 space-y-1 border-b bg-card px-1 pb-3 pt-2">
    <p className="tabular text-base font-semibold">{formatINR(comparison.assigned)} allocated / month</p>
    {comparison.limit!==null ? <>
      <p className="text-xs text-muted-foreground">{comparison.source==="budget"?"Save & invest budget":"Saved SIP total"}: {formatINR(comparison.limit)}/month</p>
      <p className={cn("tabular text-sm font-semibold",comparison.over>0?"text-danger":comparison.left>0?"text-warning":"text-success")}>
        {comparison.over>0?`${formatINR(comparison.over)} over ${comparison.source==="budget"?"budget":"your saved SIP total"}`:comparison.left>0?`${formatINR(comparison.left)} left to allocate`:"Fully allocated"}
      </p>
    </> : <p className="text-xs text-muted-foreground">No monthly budget or saved SIP total to compare yet.</p>}
  </div>;
  const list=(editable:boolean)=>{const shown=editable?values:start();return <ul className="divide-y">{goals.map(g=><li key={g.id} className="py-2">
    <div className="flex min-h-10 items-center justify-between gap-3">
      {editable?<label htmlFor={`sip-${g.id}`} className="min-w-0 break-words text-sm font-medium">{g.label}</label>:<p className="min-w-0 break-words text-sm font-medium">{g.label}</p>}
      {editable?<div className="w-32 shrink-0"><MoneyInput id={`sip-${g.id}`} aria-label={`${g.label} SIP a month`} value={shown[g.id]??null} onChange={v=>setAmounts(a=>({...a,[g.id]:v}))}/></div>:<p className="tabular shrink-0 text-sm font-semibold">{formatINR(shown[g.id]??0)}</p>}
    </div>
    {g.requiredMonthly!=null&&<p className="mb-1 text-xs text-muted-foreground">Required: {formatINR(g.requiredMonthly)}/month</p>}
    {(shown[g.id]??0)>0&&(g.vehicles?.length??0)>0&&<>
      {resolved(g,shown[g.id]??0).error ? <p className="text-xs text-warning">Review this split: an investment or goal amount changed.</p> : <ul aria-label={`${g.label} split`} className="space-y-1 border-l-2 border-border pl-3">{g.vehicles!.map((v,i)=><li key={v.id??i} className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground"><span className="min-w-0 break-words">{v.label}</span><span className="tabular shrink-0">{formatINR(resolved(g,shown[g.id]??0).amounts[v.id??String(i)]??0)}</span></li>)}</ul>}
      {!editable && g.vehicles!.every(v=>v.id) && (g.vehicles!.length>1 || !!resolved(g,shown[g.id]??0).error) && <button type="button" disabled={pending} className="min-h-9 text-xs text-primary underline decoration-dotted underline-offset-4" onClick={()=>{setEditing(false);setEditRevision(revision);setSplitGoal(g.id);}}>Adjust split<span className="sr-only"> for {g.label}</span></button>}
    </>}
  </li>)}</ul>;};
  return <section id="sips" aria-label="Your SIPs" className="surface-card space-y-3 rounded-2xl border bg-card p-4">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Your SIPs</h3><Button variant="outline" size="sm" disabled={pending||!goals.length} onClick={()=>{setSplitGoal(null);setAmounts(start());setEditRevision(revision);setEditing(true);}}>Edit SIPs</Button></div>
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
      <div><p id="include-sips-label" className="text-sm font-medium">Include SIPs in goals</p><p id="include-sips-hint" className="mt-0.5 text-xs text-muted-foreground">{included?"Monthly contributions count in projections.":"Draft only. Not counted toward goals."}</p></div>
      <button type="button" role="switch" aria-labelledby="include-sips-label" aria-describedby="include-sips-hint" aria-checked={included} disabled={pending} onClick={()=>onInclude?.(!included)} className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",included?"bg-primary":"bg-border")}><span className={cn("size-5 rounded-full bg-white shadow-sm transition-transform",included?"translate-x-6":"translate-x-1")}/></button>
    </div>
    {summary(savedStatus)}
    {savedStatus.assigned>0&&<CompactAllocation label="Investment mix" items={mix.map(m=>{const c=ASSET_CLASSES.find(x=>x.key===m.key);return {key:m.key,label:c?.label??"No fund yet",value:m.value,share:m.share,slot:c?.slot??7};})}/>}
    {!goals.length?<p className="text-sm text-muted-foreground">Add a goal first, then set a monthly SIP for it here.</p>:list(false)}
    {!isEditing&&!isSplitOpen&&error&&<p role="alert" className="text-sm text-danger">{error}</p>}
    <p className="text-xs text-muted-foreground">Plans only. Set up SIPs with your provider.</p>
    {isSplitOpen&&selected&&<SipSplitSheet name={selected.label} total={saved.get(selected.id)??0} vehicles={selected.vehicles??[]} saved={goalVehicleAmounts(rows,selected.id,saved.get(selected.id)??0)} pending={pending} error={error} onClose={()=>{if(!pending)setSplitGoal(null);}} onSave={pins=>onSave(withGoalVehicleAmounts(rows,selected.id,selected.label,pins),"Split saved.")} />}
    {isEditing&&<Sheet title="Edit SIPs" onClose={cancel}><div className="space-y-3">{editSummary}<p className="text-xs text-muted-foreground">{changed?"Unsaved changes":"Enter the monthly amount for each goal. Blank means ₹0."}</p><fieldset disabled={pending} className="min-w-0">{list(true)}</fieldset>{error&&<p role="alert" className="text-sm text-danger">{error}</p>}<SheetActions pending={pending} disabled={!changed} label="Save SIPs" onCancel={cancel} onSave={()=>onSave(draft,"SIPs saved.")}/></div></Sheet>}
  </section>;
}
