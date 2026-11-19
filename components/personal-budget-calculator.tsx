"use client";
import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { calculatePersonalBudget } from "@/lib/personal-budget";
import { formatINR } from "@/lib/format";

export function PersonalBudgetCalculator({transport:initialTransport=0,minimum=0,available,onUse}:{transport?:number;minimum?:number;available:number;onUse:(amount:number)=>void}){
 const [transport,setTransport]=useState(initialTransport),[daily,setDaily]=useState(0),[days,setDays]=useState(30),[fun,setFun]=useState(0);
 const result=calculatePersonalBudget(transport,daily,days,fun);
 const suggested=result?Math.max(minimum,result.total):0;
 return <details className="rounded-xl border p-3"><summary className="min-h-10 cursor-pointer text-sm font-medium text-primary">Help me estimate Personal spending</summary><div className="space-y-3 pt-2">
  <p className="text-xs text-muted-foreground">Build one monthly total. Count each cost once and leave out rent, household bills and other Essentials.</p>
  <Field label="Monthly personal transport" htmlFor="personal-transport"><MoneyInput id="personal-transport" value={transport} onChange={v=>setTransport(v??0)} /></Field>
  <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2"><Field label="Everyday spend per day" htmlFor="personal-daily"><MoneyInput id="personal-daily" value={daily} onChange={v=>setDaily(v??0)} /></Field><Field label="Days/month" htmlFor="personal-days"><Input id="personal-days" type="number" min="0" max="31" step="1" value={days} onChange={e=>setDays(Number(e.target.value))} /></Field></div>
  <p className="text-xs text-muted-foreground">Meals out, coffee or small personal purchases, excluding transport. Choose 22 days for a workday estimate or 30 for most days.</p>
  <Field label="Monthly fun & guilt-free money" htmlFor="personal-fun"><MoneyInput id="personal-fun" value={fun} onChange={v=>setFun(v??0)} /></Field>
  {result?<><p className="text-xs text-muted-foreground">{formatINR(result.transport)} transport + {formatINR(result.everyday)} everyday spending + {formatINR(result.fun)} fun.</p><p className="text-sm">Suggested Personal spending: <b className="tabular">{formatINR(suggested)}</b></p>{minimum>0&&<p className="text-xs text-muted-foreground">Includes at least {formatINR(minimum)} of named personal costs already in this plan. This is a total, not an extra allocation.</p>}{suggested>available&&<p role="alert" className="text-xs text-danger">This is {formatINR(suggested-available)} more than the income left after Essentials. Reduce costs or this estimate before saving.</p>}</>:<p role="alert" className="text-xs text-danger">Use whole rupees and 0–31 days. The total must be within the supported limit.</p>}
  <Button type="button" variant="outline" className="w-full" disabled={!result||suggested<=0||suggested>available} onClick={()=>onUse(suggested)}>Use this estimate</Button>
  <p className="text-xs text-muted-foreground">Adjusts the proposal only. Review Save & invest before saving.</p>
 </div></details>;
}
