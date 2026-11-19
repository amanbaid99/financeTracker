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

export function BudgetGuide({ initial, costs, loans, replacing, onCancel, onSaved }: { initial: BudgetSheet; costs: KnownBudgetCost[]; loans: SheetLoan[]; replacing: boolean; onCancel:()=>void; onSaved:(plan:BudgetSheet)=>void }) {
  const [salary,setSalary]=useState(initial.salary);
  const [known,setKnown]=useState(()=>guideCosts(initial,costs,loans));
  const [extra,setExtra]=useState<BudgetSheetRow[]>([]);
  const [annual,setAnnual]=useState(()=>{const existing=initial.rows.find(r=>r.id==="guide-annual");return existing?Math.min(1e9,rowAmount(existing,initial.salary)*12):0;});
  const [buffer,setBuffer]=useState(true);
  const [spending,setSpending]=useState<number|null>(null);
  const [step,setStep]=useState(0);
  const [answer,setAnswer]=useState(0);
  const [otherName,setOtherName]=useState("");
  const [customSplit,setCustomSplit]=useState<{savings:number;investing:number}|null>(null);
  const [error,setError]=useState("");
  const [pending,start]=useTransition();
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:"nearest"});},[step]);
  const questions=COST_QUESTIONS.filter(q=>!known.some(item=>item.included&&q.match.test(item.row.name)));
  const annualStep=2+questions.length, bufferStep=annualStep+1, spendingStep=bufferStep+1, reviewStep=spendingStep+1;
  const confirmed=known.filter(i=>i.included).map(i=>({...i.row,mode:"amount" as const,value:rowAmount(i.row,salary)}));
  const rows=[...confirmed,...extra,...(annual>0?[{id:"guide-annual",name:"Annual expenses provision",category:"savings" as const,mode:"amount" as const,value:Math.ceil(annual/12),loanId:null}]:[])];
  const recommendation=recommendBudget(salary,rows,buffer,spending);
  const split=customSplit??recommendation;
  const plan=composeGuidedBudget(salary,rows,loans,split.savings,split.investing);
  const provision=Math.ceil(annual/12);
  const valid=budgetSheetSchema.safeParse(plan).success && split.savings>=provision && sheetTotals(plan).remaining>=0;
  const question=step>=2&&step<annualStep?questions[step-2]:null;
  useEffect(()=>{
    const warn=(e:BeforeUnloadEvent)=>e.preventDefault();window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);
  },[]);
  function navigate(next:number){setStep(next);const q=questions[next-2];setAnswer(extra.find(r=>r.id===`guide-cost-${q?.id}`)?.value??0);setOtherName("");setError("");}
  function advance(){navigate(step+1);setCustomSplit(null);}
  function addCost(){
    if(!question||answer<=0||answer>1e9||rows.length>=95)return;
    const id=question.id==="other"?crypto.randomUUID():`guide-cost-${question.id}`;
    setExtra(r=>[...r.filter(item=>item.id!==id),{id,name:question.id==="other"?otherName.trim()||"Other essentials":question.name,category:"fixed",mode:"amount",value:answer,loanId:null}]);
    setAnswer(0);setOtherName("");setCustomSplit(null);
  }
  function save(){if(!valid)return;setError("");start(async()=>{try{const result=await saveBudgetSheet(plan);if(!result.ok){setError(result.error);return;}onSaved(plan);}catch{setError("Could not save. Your answers are still here. Try again.");}});}
  const personal=plan.rows.filter(r=>r.category==="personal").reduce((s,r)=>s+rowAmount(r,salary),0);
  const title=step===0?"What lands in your account each month?":step===1?"We found these costs. Keep any of them?":question?question.question:step===annualStep?"Any bills that come once a year?":step===bufferStep?"Are you still building emergency savings?":step===spendingStep?"How much spending room would feel comfortable?":"Here is your starting plan";
  return <section aria-label="Budget setup" data-guide="budget-sheet" className="space-y-4">
    <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Step {step+1} of {reviewStep+1}</p><Button variant="ghost" size="sm" disabled={pending} onClick={onCancel}>Close setup <X className="size-4" aria-hidden /></Button></div>
    <progress aria-label="Budget setup progress" max={reviewStep+1} value={step+1} className="h-1.5 w-full accent-primary" />
    <div className="surface-card space-y-5 rounded-2xl border bg-card p-5">
      <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold" aria-live="polite">{title}</h2>
      <fieldset disabled={pending} className="min-w-0 space-y-4">
      {step===0&&<><p className="text-sm text-muted-foreground">Your take-home income after tax. A normal month is enough.</p><Field label="Monthly take-home income" htmlFor="guide-income"><MoneyInput id="guide-income" value={salary||null} onChange={v=>{setSalary(v??0);setCustomSplit(null);}} /></Field><Button className="w-full" disabled={salary<=0||salary>1e9} onClick={advance}>Continue</Button></>}
      {step===1&&<><p className="text-sm text-muted-foreground">Include only what belongs in this budget. Amounts are monthly. Nothing is added to a saved plan yet.</p>{known.length===0?<p className="text-sm">No recorded costs to confirm. We will build the list together.</p>:<div className="divide-y">{known.map((item,index)=><div key={item.row.id} className="space-y-2 py-3"><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={item.included} onChange={e=>{setKnown(items=>items.map((i,j)=>j===index?{...i,included:e.target.checked}:i));setCustomSplit(null);}} /><span className="min-w-0 break-words">{item.row.name}<span className="block text-xs text-muted-foreground">{item.source}</span></span></label>{item.included&&<MoneyInput aria-label={`${item.row.name} monthly amount`} value={rowAmount(item.row,salary)} onChange={v=>{setKnown(items=>items.map((i,j)=>j===index?{...i,row:{...i.row,mode:"amount",value:v??0}}:i));setCustomSplit(null);}} />}</div>)}</div>}<p className="text-xs text-muted-foreground">Check any possible overlap between recorded costs and loan EMIs. Savings, investing and discretionary amounts will be rebuilt at the end. Existing investments and SIPs are not imported.</p><Button className="w-full" onClick={advance}>Use selected costs</Button></>}
      {question&&<><p className="text-sm text-muted-foreground">{question.hint}</p>{question.id==="other"&&<Field label="Expense name" htmlFor="guide-other-name"><Input id="guide-other-name" maxLength={80} value={otherName} onChange={e=>setOtherName(e.target.value)} placeholder="e.g. Family support" /></Field>}<Field label="Monthly amount" htmlFor="guide-cost"><MoneyInput id="guide-cost" value={answer||null} onChange={v=>setAnswer(v??0)} /></Field>
        {extra.length>0&&<details className="text-sm"><summary className="min-h-10 cursor-pointer text-primary">Costs added in this setup ({extra.length})</summary><ul className="divide-y">{extra.map(r=><li key={r.id} className="flex items-center justify-between gap-2 py-2"><span className="min-w-0 break-words">{r.name} · {formatINR(r.value)}</span><Button variant="ghost" size="sm" aria-label={`Remove ${r.name}`} onClick={()=>{setExtra(items=>items.filter(i=>i.id!==r.id));setCustomSplit(null);}}>Remove</Button></li>)}</ul></details>}
        {question.id==="other"?<><Button className="w-full" variant="outline" disabled={answer<=0||answer>1e9||!otherName.trim()||rows.length>=95} onClick={addCost}><Plus className="size-4" />Add this expense</Button><Button className="w-full" disabled={answer>1e9||(answer>0&&(!otherName.trim()||rows.length>=95))} onClick={()=>{if(answer>0){if(!otherName.trim()||answer>1e9)return;addCost();}advance();}}>That is everything</Button></>:<><Button className="w-full" disabled={answer<=0||answer>1e9||rows.length>=95} onClick={()=>{addCost();advance();}}>Add and continue</Button><Button variant="ghost" className="w-full" onClick={()=>{setExtra(items=>items.filter(r=>r.id!==`guide-cost-${question.id}`));advance();}}>Not applicable / already covered</Button></>}
      </>}
      {step===annualStep&&<><p className="text-sm text-muted-foreground">Add the yearly total for bills not already included, such as annual premiums or renewals. We will set aside a little each month in Savings.</p><Field label="Annual bills total" htmlFor="guide-annual"><MoneyInput id="guide-annual" value={annual||null} onChange={v=>{setAnnual(v??0);setCustomSplit(null);}} /></Field>{annual>0&&<p className="text-sm">Monthly provision: {formatINR(provision)}.</p>}<Button className="w-full" disabled={annual>1e9} onClick={advance}>{annual>0?"Include monthly provision":"No additional annual bills"}</Button></>}
      {step===bufferStep&&<><p className="text-sm text-muted-foreground">This helps us decide how much to keep accessible versus invest for the long term. No goal or investment records will change.</p><div className="space-y-2">{[[true,"Yes, I am building a buffer"],[false,"I already have a comfortable buffer"]].map(([value,label])=><label key={String(value)} className="flex min-h-12 items-center gap-3 rounded-xl border p-3 text-sm"><input type="radio" name="buffer" checked={buffer===value} onChange={()=>{setBuffer(value as boolean);setCustomSplit(null);}} />{label}</label>)}</div><Button className="w-full" onClick={advance}>Continue</Button></>}
      {step===spendingStep&&<><p className="text-sm text-muted-foreground">For eating out, shopping, fun or anything you enjoy, after the essentials above. Leave this blank and we will suggest an amount.</p><Field label="Preferred monthly guilt-free spending (optional)" htmlFor="guide-spending"><MoneyInput id="guide-spending" value={spending} onChange={v=>{setSpending(v);setCustomSplit(null);}} /></Field><Button className="w-full" disabled={spending!==null&&spending>1e9} onClick={advance}>Show my recommended plan</Button></>}
      {step===reviewStep&&<>
        <p className="text-sm text-muted-foreground">A practical starting point from your answers. Adjust the rupee amounts until it feels right.</p>
        <div className="flex items-center justify-between text-sm"><span>Take-home income</span><b>{formatINR(salary)}</b></div>
        <div className="flex items-center justify-between rounded-xl bg-muted/50 p-3 text-sm"><span>Essentials</span><b>{formatINR(expenseTotal(rows,salary))}</b></div>
        <Field label="Monthly savings" htmlFor="guide-saving"><MoneyInput id="guide-saving" value={split.savings} onChange={v=>setCustomSplit({savings:v??0,investing:split.investing})} /></Field>
        <Field label="Monthly investing" htmlFor="guide-investing"><MoneyInput id="guide-investing" value={split.investing} onChange={v=>setCustomSplit({savings:split.savings,investing:v??0})} /></Field>
        <div className="rounded-xl bg-primary-soft p-3"><p className="text-sm">Guilt-free spending</p><p className="tabular text-2xl font-semibold">{formatINR(personal)}</p><p className="text-xs text-muted-foreground">What is left after essentials, savings and investing.</p></div>
        {sheetTotals(plan).remaining<0&&<p role="alert" className="text-sm text-danger">This plan is {formatINR(-sheetTotals(plan).remaining)} over your income. Go back to costs or reduce the savings and investing amounts.</p>}
        {split.savings<provision&&<p role="alert" className="text-sm text-danger">Savings needs at least {formatINR(provision)} to cover the annual bills you entered.</p>}
        {spending!==null&&personal<spending&&<p className="text-sm text-warning">This leaves {formatINR(spending-personal)} less spending room than you preferred. Review costs or the future-money amounts.</p>}
        {customSplit&&<Button variant="ghost" size="sm" onClick={()=>setCustomSplit(null)}>Restore recommendation</Button>}
        <details className="text-sm"><summary className="min-h-10 cursor-pointer text-primary">How we made the suggestion</summary><ul className="list-disc space-y-2 pl-5 text-xs text-muted-foreground">{recommendation.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></details>
        <details className="text-sm"><summary className="min-h-10 cursor-pointer text-primary">Review included costs ({rows.length})</summary><ul className="divide-y">{rows.map(r=><li key={r.id} className="flex justify-between gap-3 py-2"><span className="min-w-0 break-words">{r.name}</span><span className="shrink-0 tabular">{formatINR(rowAmount(r,salary))}</span></li>)}</ul><Button variant="ghost" size="sm" onClick={()=>setStep(1)}>Change costs</Button></details>
        {replacing&&<p className="text-xs text-muted-foreground">Saving replaces your current budget with this plan. Goals, investments and SIP records stay as they are.</p>}
        {!budgetSheetSchema.safeParse(plan).success&&<p role="alert" className="text-sm text-danger">{budgetSheetSchema.safeParse(plan).error?.issues[0]?.message}</p>}
        {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
        <Button className="w-full" disabled={!valid} onClick={save}>{pending?"Saving…":"Save this budget"}</Button>
      </>}
      </fieldset>
    </div>
    {step>0&&<Button variant="ghost" disabled={pending} onClick={()=>navigate(step-1)}><ArrowLeft className="size-4" />Back</Button>}
  </section>;
}
