"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/money-input";
import { Field } from "@/components/forms/field";
import { saveBudgetSheet } from "@/lib/budget-ratio-actions";
import { COST_QUESTIONS, composeGuidedBudget, guideCosts, recommendBudget, expenseTotal } from "@/lib/budget-guide";
import { budgetSheetSchema, rowAmount, sheetTotals, type BudgetSheet, type BudgetSheetRow, type SheetLoan } from "@/lib/budget-sheet";
import type { KnownBudgetCost } from "@/lib/budget-assist";
import { formatINR } from "@/lib/format";

export function BudgetGuide({ initial, costs, loans, replacing, onCancel, onSaved }: { initial: BudgetSheet; costs: KnownBudgetCost[]; loans: SheetLoan[]; replacing: boolean; onCancel:()=>void; onSaved:(plan:BudgetSheet,createSip?:boolean)=>void }) {
  const [salary,setSalary]=useState(initial.salary);
  const [known,setKnown]=useState(()=>guideCosts(initial,costs,loans));
  const [extra,setExtra]=useState<BudgetSheetRow[]>([]);
  const [spending,setSpending]=useState<number|null>(null);
  const [step,setStep]=useState(0);
  const [answer,setAnswer]=useState(0);
  const [otherName,setOtherName]=useState("");
  const [customSplit,setCustomSplit]=useState<{future:number}|null>(null);
  const [error,setError]=useState("");
  const [pending,start]=useTransition();
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:"nearest"});},[step]);
  const questions=COST_QUESTIONS.filter(q=>q.id!=="other"&&!known.some(item=>item.included&&q.match.test(item.row.name)));
  const pairs=Array.from({length:Math.ceil(questions.length/2)},(_,index)=>questions.slice(index*2,index*2+2));
  const otherStep=2+pairs.length, spendingStep=otherStep+1, reviewStep=spendingStep+1;
  const currentQuestions=step>=2&&step<otherStep?pairs[step-2]:null;
  const confirmed=known.filter(i=>i.included).map(i=>({...i.row,mode:"amount" as const,value:rowAmount(i.row,salary)}));
  const rows=[...confirmed,...extra];
  const recommendation=recommendBudget(salary,rows,spending);
  const split=customSplit??recommendation;
  const plan=composeGuidedBudget(salary,rows,loans,split.future);
  const valid=budgetSheetSchema.safeParse(plan).success && sheetTotals(plan).remaining>=0;

  useEffect(()=>{
    const warn=(e:BeforeUnloadEvent)=>e.preventDefault();window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);
  },[]);
  function navigate(next:number){setStep(next);setAnswer(0);setOtherName("");setError("");}
  function advance(){navigate(step+1);setCustomSplit(null);}
  function addCost(){
    if(step!==otherStep||answer<=0||answer>1e9||rows.length>=95)return;
    const id=crypto.randomUUID();
    setExtra(r=>[...r.filter(item=>item.id!==id),{id,name:otherName.trim()||"Other essentials",category:"fixed",mode:"amount",value:answer,loanId:null}]);
    setAnswer(0);setOtherName("");setCustomSplit(null);
  }
  function save(createSip=false){if(!valid)return;setError("");start(async()=>{try{const result=await saveBudgetSheet(plan);if(!result.ok){setError(result.error);return;}onSaved(plan,createSip);}catch{setError("Could not save. Your answers are still here. Try again.");}});}
  const personal=plan.rows.filter(r=>r.category==="personal").reduce((s,r)=>s+rowAmount(r,salary),0);
  const title=step===0?"What lands in your account each month?":step===1?"We found these costs. Keep any of them?":currentQuestions?"A couple of monthly costs":step===otherStep?"Any other regular essentials?":step===spendingStep?"How much spending room would feel comfortable?":"Here is your starting plan";
  return <section aria-label="Budget setup" data-guide="budget-sheet" className="space-y-4">
    <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Step {step+1} of {reviewStep+1}</p><Button variant="ghost" size="sm" disabled={pending} onClick={onCancel}>Close setup <X className="size-4" aria-hidden /></Button></div>
    <progress aria-label="Budget setup progress" max={reviewStep+1} value={step+1} className="h-1.5 w-full accent-primary" />
    <div className="surface-card space-y-5 rounded-2xl border bg-card p-5">
      <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold" aria-live="polite">{title}</h2>
      <fieldset disabled={pending} className="min-w-0 space-y-4">
      {step===0&&<><p className="text-sm text-muted-foreground">Your take-home income after tax. A normal month is enough.</p><Field label="Monthly take-home income" htmlFor="guide-income"><MoneyInput id="guide-income" value={salary||null} onChange={v=>{setSalary(v??0);setCustomSplit(null);}} /></Field><Button className="w-full" disabled={salary<=0||salary>1e9} onClick={advance}>Continue</Button></>}
      {step===1&&<><p className="text-sm text-muted-foreground">Confirm your recorded commitments first. Groceries, everyday costs and personal transport are left out here; we will ask about them later. Nothing is saved yet.</p>{known.length===0?<p className="text-sm">No recorded costs to confirm. We will build the list together.</p>:<div className="divide-y">{known.map((item,index)=><div key={item.row.id} className="space-y-2 py-3"><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={item.included} onChange={e=>{setKnown(items=>items.map((i,j)=>j===index?{...i,included:e.target.checked}:i));setCustomSplit(null);}} /><span className="min-w-0 break-words">{item.row.name}<span className="block text-xs text-muted-foreground">{item.source}</span></span></label>{item.included&&<MoneyInput aria-label={`${item.row.name} monthly amount`} value={rowAmount(item.row,salary)} onChange={v=>{setKnown(items=>items.map((i,j)=>j===index?{...i,row:{...i.row,mode:"amount",value:v??0}}:i));setCustomSplit(null);}} />}</div>)}</div>}<p className="text-xs text-muted-foreground">Check any possible overlap between recorded costs and loan EMIs. Save & invest and personal amounts will be rebuilt at the end. Existing investments and SIPs are not imported.</p><Button className="w-full" onClick={advance}>Use selected costs</Button></>}
      {currentQuestions&&<>
        <p className="text-sm text-muted-foreground">Add only costs you pay. Leave an amount blank or zero if it does not apply or is already covered.</p>
        {currentQuestions.map(question=>{
          const id=`guide-cost-${question.id}`;
          const row=extra.find(r=>r.id===id);
          return <Field key={id} label={question.question} htmlFor={id} hint={question.hint}><MoneyInput id={id} value={row?.value||null} onChange={v=>{
            setExtra(items=>[...items.filter(r=>r.id!==id),...(v?[{id,name:question.name,category:"fixed" as const,mode:"amount" as const,value:v,loanId:null}]:[])]);setCustomSplit(null);
          }} /></Field>;
        })}
        <Button className="w-full" disabled={currentQuestions.some(q=>(extra.find(r=>r.id===`guide-cost-${q.id}`)?.value??0)>1e9)||rows.length>95} onClick={advance}>Continue</Button>
      </>}
      {step===otherStep&&<>
        <p className="text-sm text-muted-foreground">Family support, subscriptions or another monthly commitment. Personal transport and everyday personal spending come next.</p>
        <Field label="Expense name" htmlFor="guide-other-name"><Input id="guide-other-name" maxLength={80} value={otherName} onChange={e=>setOtherName(e.target.value)} placeholder="e.g. Family support" /></Field>
        <Field label="Monthly amount" htmlFor="guide-cost"><MoneyInput id="guide-cost" value={answer||null} onChange={v=>setAnswer(v??0)} /></Field>
        {extra.length>0&&<details className="text-sm"><summary className="min-h-10 cursor-pointer text-primary">Costs added in this setup ({extra.length})</summary><ul className="divide-y">{extra.map(r=><li key={r.id} className="flex items-center justify-between gap-2 py-2"><span className="min-w-0 break-words">{r.name} · {formatINR(r.value)}</span><Button variant="ghost" size="sm" aria-label={`Remove ${r.name}`} onClick={()=>{setExtra(items=>items.filter(i=>i.id!==r.id));setCustomSplit(null);}}>Remove</Button></li>)}</ul></details>}
        <Button className="w-full" variant="outline" disabled={answer<=0||answer>1e9||!otherName.trim()||rows.length>=95} onClick={addCost}><Plus className="size-4" />Add this expense</Button>
        <Button className="w-full" disabled={answer>1e9||(answer>0&&(!otherName.trim()||rows.length>=95))} onClick={()=>{if(answer>0)addCost();advance();}}>That is everything</Button>
      </>}
      {step===spendingStep&&<><p className="text-sm text-muted-foreground">One total for your personal transport, day-to-day purchases and guilt-free money. Enter a monthly amount, or leave it blank for a starting suggestion.</p><Field label="Preferred monthly Personal spending (optional)" htmlFor="guide-spending"><MoneyInput id="guide-spending" value={spending} onChange={v=>{setSpending(v);setCustomSplit(null);}} /></Field><Button className="w-full" disabled={spending!==null&&spending>1e9} onClick={advance}>Show my recommended plan</Button></>}
      {step===reviewStep&&<>
        <p className="text-sm text-muted-foreground">A practical starting point from your answers. Adjust the rupee amounts until it feels right.</p>
        <div className="flex items-center justify-between text-sm"><span>Take-home income</span><b>{formatINR(salary)}</b></div>
        <div className="flex items-center justify-between rounded-xl bg-muted/50 p-3 text-sm"><span>Essentials</span><b>{formatINR(expenseTotal(rows,salary))}</b></div>
        <Field label="Monthly save & invest" htmlFor="guide-future"><MoneyInput id="guide-future" value={split.future} onChange={v=>setCustomSplit({future:v??0})} /></Field>
        <div className="rounded-xl bg-primary-soft p-3"><p className="text-sm">Personal spending</p><p className="tabular text-2xl font-semibold">{formatINR(personal)}</p><p className="text-xs text-muted-foreground">What is left after essentials and Save & invest.</p></div>
        {sheetTotals(plan).remaining<0&&<p role="alert" className="text-sm text-danger">This plan is {formatINR(-sheetTotals(plan).remaining)} over your income. Go back to costs or reduce the Save & invest amount.</p>}

        {spending!==null&&personal<spending&&<p className="text-sm text-warning">This leaves {formatINR(spending-personal)} less spending room than you preferred. Review costs or the future-money amounts.</p>}
        {customSplit&&<Button variant="ghost" size="sm" onClick={()=>setCustomSplit(null)}>Restore recommendation</Button>}
        <details className="text-sm"><summary className="min-h-10 cursor-pointer text-primary">How we made the suggestion</summary><ul className="list-disc space-y-2 pl-5 text-xs text-muted-foreground">{recommendation.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></details>
        <details className="text-sm"><summary className="min-h-10 cursor-pointer text-primary">Review included costs ({rows.length})</summary><ul className="divide-y">{rows.map(r=><li key={r.id} className="flex justify-between gap-3 py-2"><span className="min-w-0 break-words">{r.name}</span><span className="shrink-0 tabular">{formatINR(rowAmount(r,salary))}</span></li>)}</ul><Button variant="ghost" size="sm" onClick={()=>setStep(1)}>Change costs</Button></details>
        {replacing&&<p className="text-xs text-muted-foreground">Saving replaces your current budget with this plan. Goals, investments and SIP records stay as they are.</p>}
        {!budgetSheetSchema.safeParse(plan).success&&<p role="alert" className="text-sm text-danger">{budgetSheetSchema.safeParse(plan).error?.issues[0]?.message}</p>}
        {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
        <Button className="w-full" disabled={!valid} onClick={()=>save()}>{pending?"Saving…":"Save this budget"}</Button>
        {split.future>0&&<Button variant="outline" className="w-full" disabled={!valid||pending} onClick={()=>save(true)}>Save & create SIP plan</Button>}
      </>}
      </fieldset>
    </div>
    {step>0&&<Button variant="ghost" disabled={pending} onClick={()=>navigate(step-1)}><ArrowLeft className="size-4" />Back</Button>}
  </section>;
}
