"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Sparkles } from "lucide-react";
import { BudgetGuide } from "@/components/budget-guide";
import { Sheet } from "@/components/sheet";
import { Field } from "@/components/forms/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PersonalBudgetCalculator } from "@/components/personal-budget-calculator";
import { isPersonalTransport, personalMinimum, groupPersonalCosts } from "@/lib/personal-budget";
import { MoneyInput } from "@/components/money-input";
import { saveBudgetSheet, resetBudgetSheet } from "@/lib/budget-ratio-actions";
import { formatINR } from "@/lib/format";
import { applyBudgetRules, budgetRuleGaps, budgetSheetSchema, emptyBudgetSheet, isRuleRow, rowAmount, targetAmount, sheetTotals, type BudgetSheet, type SheetLoan } from "@/lib/budget-sheet";
import type { KnownBudgetCost } from "@/lib/budget-assist";
const BUCKETS=[{id:"essentials",name:"Essentials",color:"bg-slate-500",hint:"Housing, bills, EMIs and necessary everyday costs."},{id:"future",name:"Save & invest",color:"bg-primary",hint:"One monthly amount for saving and investing. Annual contributions stay in Goals."},{id:"personal",name:"Personal spending",color:"bg-pink-500",hint:"Personal transport, everyday spending and guilt-free money together. This is a plan, not an account balance."}] as const;
const bucketFor=(category:string)=>category==="savings"||category==="investing"?"future":category==="personal"?"personal":"essentials";
export function BudgetExperience({initial,saved:hasSaved,salary,loans,knownCosts,loadError}:{initial:BudgetSheet|null;saved:boolean;salary:number;loans:SheetLoan[];knownCosts:KnownBudgetCost[];loadError:string|null}){
  const [plan,setPlan]=useState<BudgetSheet|null>(hasSaved&&initial?groupPersonalCosts(initial):null);
  const [guide,setGuide]=useState(false);
  const [edit,setEdit]=useState<BudgetSheet|null>(null);
  const [reset,setReset]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [pending,start]=useTransition();
  const router=useRouter();
  function keep(next:BudgetSheet){setPlan(next);setGuide(false);setEdit(null);setMessage("Budget saved.");setError("");router.refresh();}
  const totals=plan?BUCKETS.map(bucket=>({...bucket,amount:plan.rows.filter(r=>bucketFor(r.category)===bucket.id).reduce((s,r)=>s+rowAmount(r,plan.salary),0)})):[];
  const editPlan=edit?applyBudgetRules(edit):null;
  const editValid=editPlan&&budgetSheetSchema.safeParse(editPlan).success&&budgetRuleGaps(editPlan).length===0;
  function saveEdits(){if(!editPlan||!editValid)return;setError("");start(async()=>{try{const result=await saveBudgetSheet(editPlan);if(!result.ok){setError(result.error);return;}keep(editPlan);}catch{setError("Could not save. Your edits are still here.");}});}
  if(guide&&!loadError)return <BudgetGuide initial={plan??emptyBudgetSheet(salary)} costs={knownCosts} loans={loans} replacing={!!plan} onCancel={()=>{setGuide(false);}} onSaved={keep} />;
  return <section aria-label="Your budget" data-guide="budget-sheet" className="space-y-4">
    {loadError&&<p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{loadError}</p>}
    {!plan?<div className="surface-card space-y-4 rounded-2xl border bg-card p-6"><Sparkles className="size-7 text-primary" aria-hidden /><h2 className="text-xl font-semibold">A plan for your money. Room for your life.</h2><p className="text-sm text-muted-foreground">Answer a few simple questions. We will suggest one amount to save and invest, plus room to enjoy, with no percentages to work out.</p><Button className="w-full" disabled={!!loadError} onClick={()=>setGuide(true)}>Plan my budget</Button><p className="text-xs text-muted-foreground">Review everything before saving. No goals or SIPs are changed.</p></div>:<>
      <div className="surface-card space-y-4 rounded-2xl border bg-card p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">Monthly take-home</span><b className="tabular text-lg">{formatINR(plan.salary)}</b></div>
        <div aria-hidden className="flex h-2 overflow-hidden rounded-full bg-muted">{totals.map(bucket=><span key={bucket.id} className={bucket.color} style={{width:`${bucket.amount/Math.max(plan.salary,sheetTotals(plan).allocated,1)*100}%`}} />)}</div>
        <div className="divide-y">{totals.map(bucket=><details key={bucket.id} className="group"><summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 py-3"><span className={`size-2.5 shrink-0 rounded-full ${bucket.color}`} aria-hidden /><span className="min-w-0 flex-1 text-sm font-medium">{bucket.name}</span><span className="shrink-0 text-right"><b className="tabular block">{formatINR(bucket.amount)}</b><span className="text-xs text-muted-foreground">{plan.salary>0?`${(bucket.amount/plan.salary*100).toFixed(1)}%`:""}</span></span><ChevronDown className="size-4 shrink-0 text-muted-foreground group-open:rotate-180" aria-hidden /></summary><div className="space-y-2 pb-3 pl-5 text-xs text-muted-foreground"><p>{bucket.hint}</p><ul className="space-y-2">{plan.rows.filter(r=>bucketFor(r.category)===bucket.id).map(r=><li key={r.id} className="flex justify-between gap-3"><span className="min-w-0 break-words">{isRuleRow(r)?r.category==="personal"?"Free to spend":"Monthly allocation":r.name}</span><span className="tabular shrink-0">{formatINR(rowAmount(r,plan.salary))}</span></li>)}</ul>{bucket.amount===0&&<p>No amount set aside yet.</p>}</div></details>)}</div>
        {sheetTotals(plan).remaining<0?<p role="alert" className="text-sm text-danger">This plan is {formatINR(-sheetTotals(plan).remaining)} over income. Edit the budget to close the gap.</p>:sheetTotals(plan).remaining>0?<p className="text-xs text-muted-foreground">{formatINR(sheetTotals(plan).remaining)} is unassigned in your existing budget. Rebuild with the guide for a complete plan.</p>:<p className="text-xs text-muted-foreground">Every rupee has a place. This is a plan, not actual spending tracked.</p>}
        <Button variant="outline" className="w-full" disabled={!!loadError} onClick={()=>{setEdit(plan);setError("");}}>Edit monthly amounts</Button>
      </div>
      <div className="flex flex-wrap justify-between gap-2"><Button variant="ghost" size="sm" disabled={!!loadError} onClick={()=>setGuide(true)}><Sparkles className="size-4" />Rebuild with guide</Button><Button variant="ghost" size="sm" disabled={!!loadError} className="text-muted-foreground" onClick={()=>{setReset(true);setError("");}}>Reset budget</Button></div>
    </>}
    {message&&<p role="status" className="text-sm text-primary">{message}</p>}
    {edit&&editPlan&&<Sheet title="Edit monthly amounts" onClose={()=>{if(!pending)setEdit(null);}}><fieldset disabled={pending} className="min-w-0 space-y-4">
      <Field label="Monthly take-home income" htmlFor="edit-income"><MoneyInput id="edit-income" value={edit.salary} onChange={v=>setEdit({...edit,salary:v??0})} /></Field>
      <Field label="Monthly save & invest" htmlFor="edit-future"><MoneyInput id="edit-future" value={edit.rules?.future?targetAmount(edit.rules.future,edit.salary):(["savings","investing"] as const).reduce((sum,category)=>sum+Math.max(edit.rules?targetAmount(edit.rules[category],edit.salary):0,edit.rows.filter(r=>r.category===category).reduce((s,r)=>s+rowAmount(r,edit.salary),0)),0)} onChange={v=>setEdit({...edit,rules:{savings:{mode:"amount",value:0},investing:{mode:"amount",value:0},future:{mode:"amount",value:v??0}}})} /></Field>
      <PersonalBudgetCalculator transport={edit.rows.filter(r=>r.category==="personal" && isPersonalTransport(r)).reduce((sum,r)=>sum+rowAmount(r,edit.salary),0)} minimum={personalMinimum(edit.rows,edit.salary)} available={Math.max(0,edit.salary-edit.rows.filter(r=>r.category!=="personal"&&r.category!=="savings"&&r.category!=="investing").reduce((sum,r)=>sum+rowAmount(r,edit.salary),0))} onUse={amount=>{
        const essentials=edit.rows.filter(r=>r.category!=="personal"&&r.category!=="savings"&&r.category!=="investing").reduce((sum,r)=>sum+rowAmount(r,edit.salary),0);
        setEdit({...edit,rules:{savings:{mode:"amount",value:0},investing:{mode:"amount",value:0},future:{mode:"amount",value:Math.max(0,edit.salary-essentials-amount)}}});
      }} />
      <p className="text-xs text-muted-foreground">Save & invest stays at this monthly amount. Personal spending gets what is left. Existing savings and investment items count toward the combined total.</p>
      <details><summary className="min-h-10 cursor-pointer text-sm font-medium">Edit included items</summary><div className="space-y-3">{edit.rows.filter(r=>!isRuleRow(r)).map(row=><div key={row.id} className="space-y-2 rounded-xl border p-3"><Input aria-label={`${row.name} name`} maxLength={80} value={row.name} onChange={e=>setEdit({...edit,rows:edit.rows.map(r=>r.id===row.id?{...r,name:e.target.value}:r)})} />{!row.loanId && (row.category === "fixed" || row.category === "variable" || row.category === "personal") && <Select aria-label={`${row.name} bucket`} value={row.category === "personal" ? "personal" : "fixed"} onChange={e=>setEdit({...edit,rows:edit.rows.map(r=>r.id===row.id?{...r,category:e.target.value as "fixed"|"personal"}:r)})}><option value="fixed">Essentials</option><option value="personal">Personal spending</option></Select>}<MoneyInput aria-label={`${row.name} amount`} value={rowAmount(row,edit.salary)} onChange={v=>setEdit({...edit,rows:edit.rows.map(r=>r.id===row.id?{...r,mode:"amount",value:v??0}:r)})} /><Button variant="ghost" size="sm" onClick={()=>setEdit({...edit,rows:edit.rows.filter(r=>r.id!==row.id),excludedLoanIds:row.loanId?[...new Set([...edit.excludedLoanIds,row.loanId])]:edit.excludedLoanIds})}>Remove {row.name}</Button></div>)}<Button variant="outline" disabled={edit.rows.length>=97} className="w-full" onClick={()=>setEdit({...edit,rows:[...edit.rows,{id:crypto.randomUUID(),name:"New essential",category:"fixed",mode:"amount",value:0,loanId:null}]})}><Plus className="size-4" />Add essential cost</Button></div></details>
      <p className="text-sm">Personal spending: <b>{formatINR(editPlan.rows.filter(r=>r.category==="personal").reduce((s,r)=>s+rowAmount(r,editPlan.salary),0))}</b></p>
      {budgetRuleGaps(editPlan).map(g=><p key={g.category} role="alert" className="text-sm text-danger">Named saving and investing items exceed the target by {formatINR(g.excess)}. Adjust the items or target.</p>)}
      {sheetTotals(editPlan).remaining<0&&<p role="alert" className="text-sm text-danger">{formatINR(-sheetTotals(editPlan).remaining)} over income. Your costs and targets have not been cut.</p>}
      {!budgetSheetSchema.safeParse(editPlan).success&&<p role="alert" className="text-sm text-danger">{budgetSheetSchema.safeParse(editPlan).error?.issues[0]?.message}</p>}
      {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
      <Button className="w-full" disabled={!editValid} onClick={saveEdits}>{pending?"Saving…":"Save changes"}</Button>
    </fieldset></Sheet>}
    {reset&&<Sheet title="Reset budget?" onClose={()=>{if(!pending)setReset(false);}}><div className="space-y-4"><p className="text-sm">This removes only your saved budget. It cannot be undone. Your loans, goals, investments and other records stay as they are.</p>{error&&<p role="alert" className="text-sm text-danger">{error}</p>}<Button variant="destructive" className="w-full" disabled={pending} onClick={()=>{setError("");start(async()=>{try{const result=await resetBudgetSheet("RESET_BUDGET");if(!result.ok){setError(result.error);return;}setPlan(null);setReset(false);setMessage("Budget reset. Start a new plan when you are ready.");router.refresh();}catch{setError("Could not reset. Try again.");}});}}>Reset and start over</Button><Button variant="outline" className="w-full" disabled={pending} onClick={()=>setReset(false)}>Keep my budget</Button></div></Sheet>}
  </section>;
}
