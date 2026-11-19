"use client";
import { useState, useTransition } from "react";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { BudgetAllocation } from "@/components/budget-allocation";
import { BUDGET_CATEGORIES, EXPENSE_PRESETS, budgetRowSchema, budgetSheetSchema, rowAmount, type BudgetSheet, type BudgetSheetRow, type SheetLoan } from "@/lib/budget-sheet";
import { assistedBudget, confirmedBudget, knownBudgetItems, moneyAvailable, suggestAssistedAllocation, type KnownBudgetCost, type ExtraAllocation } from "@/lib/budget-assist";
import type { BudgetReviewGoal } from "@/lib/budget-insights";
import { formatINR } from "@/lib/format";

export function BudgetAssistant({ initial, costs, loans, goals, recordedSips, onClose, onSave }: {
  initial: BudgetSheet; recordedSips: number; costs: KnownBudgetCost[]; loans: SheetLoan[]; goals: BudgetReviewGoal[];
  onClose: () => void; onSave: (plan: BudgetSheet) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [step, setStep] = useState(0);
  const [salary, setSalary] = useState(initial.salary);
  const [items, setItems] = useState(() => knownBudgetItems(initial, costs, loans, recordedSips));
  const [extras, setExtras] = useState<BudgetSheetRow[]>([]);
  const [allocation, setAllocation] = useState<ExtraAllocation>({ savings: 0, investing: 0, personal: 0 });
  const [proposalKey, setProposalKey] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const originalIds = new Set(initial.rows.map((r) => r.id));
  const base = confirmedBudget(initial, salary, items, extras);
  const valid = budgetSheetSchema.safeParse(base).success;
  const extraValid = extras.every((r) => budgetRowSchema.safeParse(r).success && rowAmount(r, salary) > 0);
  const available = moneyAvailable(base);
  const preview = assistedBudget(base, allocation);
  const plannedFuture = preview?.rows.filter((r) => r.category === "savings" || r.category === "investing").reduce((sum, r) => sum + rowAmount(r, salary), 0) ?? 0;
  const remainder = available - allocation.savings - allocation.investing - allocation.personal;
  function addExpense(name = "", category: BudgetSheetRow["category"] = "fixed") {
    setExtras((rows) => [...rows, { id: crypto.randomUUID(), name, category, mode: "amount", value: 0, loanId: null }]);
  }
  function reviewAllocation() {
    const key = JSON.stringify(base);
    if (key !== proposalKey) { const suggested = suggestAssistedAllocation(base, goals); setAllocation(suggested.allocation); setReasons(suggested.reasons); setProposalKey(key); }
    setError(""); setStep(2);
  }
  function save() {
    if (!preview) return;
    setError("");
    start(async () => {
      try { const result = await onSave(preview); if (!result.ok) setError(result.error ?? "Could not save. Your proposal is still here."); }
      catch { setError("Could not save. Your proposal is still here. Try again."); }
    });
  }
  return <Sheet title="Help me build my budget" onClose={() => { if (!pending) onClose(); }}>
    <fieldset disabled={pending} className="min-w-0 space-y-4 disabled:opacity-60">
      <ol aria-label="Assisted budget steps" className="flex gap-2 text-xs">{["Known costs", "Anything else?", "Review"].map((label, i) => <li key={label} aria-current={i === step ? "step" : undefined} className={`min-w-0 flex-1 rounded-xl px-2 py-2 text-center ${i === step ? "bg-primary-soft font-medium text-primary" : "bg-muted text-muted-foreground"}`}>{i + 1}. {label}</li>)}</ol>
      <p className="text-xs text-muted-foreground">Nothing is saved until you confirm the final budget.</p>
      {step === 0 && <>
        <Field label="Monthly take-home income" htmlFor="assist-income"><MoneyInput id="assist-income" value={salary || null} onChange={(v) => setSalary(v ?? 0)} /></Field>
        <div><h3 className="font-medium">Confirm what belongs in this budget</h3><p className="mt-1 text-xs text-muted-foreground">We have included known costs and your current budget items. Check amounts and untick duplicates or anything you want to leave out. Existing savings and investing amounts can stay, too.</p></div>
        {items.some((i) => originalIds.has(i.row.id) && ["savings", "investing", "personal"].includes(i.row.category)) && <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-muted/30 p-3 text-sm"><input type="checkbox" checked={items.filter((i) => originalIds.has(i.row.id) && ["savings", "investing", "personal"].includes(i.row.category)).every((i) => i.included)} onChange={(e) => setItems((list) => list.map((i) => originalIds.has(i.row.id) && ["savings", "investing", "personal"].includes(i.row.category) ? { ...i, included: e.target.checked } : i))} className="mt-0.5 size-5 shrink-0 accent-primary" /><span>Keep existing savings, investing and personal amounts</span></label>}
        <ul className="divide-y rounded-xl border">{items.map((item, i) => <li key={item.row.id} className="space-y-2 p-3"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" aria-label={`Include ${item.row.name}`} checked={item.included} onChange={(e) => setItems((rows) => rows.map((x, j) => i === j ? { ...x, included: e.target.checked } : x))} className="mt-0.5 size-5 shrink-0 accent-primary" /><span className="min-w-0"><span className="block break-words text-sm font-medium">{item.row.name}</span><span className="block text-[11px] text-muted-foreground">{item.source} · {BUDGET_CATEGORIES[item.row.category]}</span></span></label>{item.included && <MoneyInput aria-label={`${item.row.name} confirmed amount`} value={rowAmount(item.row, salary)} onChange={(v) => setItems((rows) => rows.map((x, j) => i === j ? { ...x, row: { ...x.row, mode: "amount", value: v ?? 0 } } : x))} />}</li>)}</ul>
        {!items.length && <p className="text-sm text-muted-foreground">No known items yet. Add your expenses in the next step.</p>}
      </>}
      {step === 1 && <>
        <div><h3 className="font-medium">What other expenses do you have?</h3><p className="mt-1 text-xs text-muted-foreground">Think of groceries, transport, subscriptions, family support and occasional bills. For yearly bills, enter a monthly set-aside. Leave out bills already covered by a goal SIP or another confirmed item.</p></div>
        <div className="flex flex-wrap gap-2">{EXPENSE_PRESETS.filter((p) => p.value !== "emi").map((preset) => {
          const exists = base.rows.some((r) => r.name.trim().toLocaleLowerCase() === preset.name.toLocaleLowerCase());
          return <Button key={preset.value} type="button" size="sm" variant="outline" disabled={exists || base.rows.length >= 100} onClick={() => addExpense(preset.name, preset.category)}>{preset.name}</Button>;
        })}</div>
        {extras.map((row, i) => <div key={row.id} className="space-y-2 rounded-xl border p-3"><Input aria-label={`Additional expense ${i + 1} name`} maxLength={80} placeholder="Expense name" value={row.name} onChange={(e) => setExtras((rows) => rows.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))} /><Select aria-label={`${row.name || `Expense ${i + 1}`} type`} value={row.category} onChange={(e) => setExtras((rows) => rows.map((r) => r.id === row.id ? { ...r, category: e.target.value as BudgetSheetRow["category"] } : r))}>{Object.entries(BUDGET_CATEGORIES).filter(([key]) => key !== "savings" && key !== "investing").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select><MoneyInput aria-label={`${row.name || `Expense ${i + 1}`} monthly amount`} value={row.value || null} onChange={(v) => setExtras((rows) => rows.map((r) => r.id === row.id ? { ...r, value: v ?? 0 } : r))} /><Button type="button" size="sm" variant="ghost" aria-label={`Remove additional ${row.name || `expense ${i + 1}`}`} onClick={() => setExtras((rows) => rows.filter((r) => r.id !== row.id))}>Remove</Button></div>)}
        <Button type="button" variant="outline" className="w-full" disabled={base.rows.length >= 100} onClick={() => addExpense()}>Add another expense</Button>
        {!extraValid && <p className="text-xs text-muted-foreground">Enter a name and monthly amount for each added expense, or remove it.</p>}
      </>}
      {step < 2 && <div className="rounded-xl bg-muted/40 p-3 text-sm"><p className="flex flex-wrap justify-between gap-2"><span>Confirmed items</span><span className="tabular font-medium">{formatINR(salary - available)}</span></p><p className={`mt-1 flex flex-wrap justify-between gap-2 ${available < 0 ? "text-danger" : "text-primary"}`}><span>{available < 0 ? "Above income" : "Money left"}</span><span className="tabular font-medium">{formatINR(Math.abs(available))}</span></p></div>}
      {step === 2 && <>
        <div><h3 className="font-medium">Review the money left</h3><p className="mt-1 text-sm text-muted-foreground">{formatINR(available)} is available after your confirmed items. These are additional amounts, on top of allocations you kept. Edit them or leave some money unassigned.</p></div>
        {available === 0 && <p className="rounded-xl bg-primary-soft p-3 text-sm text-primary">Your confirmed items already use the available income. You can keep this plan, or go back to rework an allocation.</p>}
        {available > 0 && ([['savings', 'Additional savings'], ['investing', 'Additional investing'], ['personal', 'Additional guilt-free spending']] as const).map(([key, label]) => <Field key={key} label={label} htmlFor={`assist-${key}`}><MoneyInput id={`assist-${key}`} value={allocation[key]} onChange={(v) => setAllocation((a) => ({ ...a, [key]: v ?? 0 }))} /></Field>)}
        <p className={`tabular text-sm ${remainder < 0 ? "text-danger" : "text-muted-foreground"}`}>{remainder < 0 ? `${formatINR(-remainder)} more than the money available. Reduce the proposed amounts.` : `${formatINR(remainder)} left unassigned.`}</p>
        <details className="text-sm"><summary className="cursor-pointer text-primary">Why these amounts?</summary><ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></details>
        {!preview && remainder >= 0 && <p className="text-xs text-danger">Check the proposed amounts, or go back and remove items if the budget exceeds 100 rows.</p>}
        {preview && <><BudgetAllocation plan={preview} goals={goals} /><details className="text-sm"><summary className="cursor-pointer text-primary">Review all budget items ({preview.rows.length})</summary><ul className="mt-2 divide-y">{preview.rows.map((r) => <li key={r.id} className="flex justify-between gap-3 py-2 text-xs"><span className="min-w-0 break-words">{r.name}</span><span className="tabular shrink-0">{formatINR(rowAmount(r, salary))}</span></li>)}</ul></details></>}
        {preview && plannedFuture < recordedSips && <p className="rounded-xl bg-warning-soft p-3 text-xs">Recorded SIPs total {formatINR(recordedSips)} a month. This plan reserves {formatINR(plannedFuture)} for saving and investing. Saving the budget does not reduce your SIPs.</p>}
        <p className="text-xs text-muted-foreground">Save confirms this budget only. Income records, loans, holdings and SIPs stay unchanged. Not investment advice.</p>
      </>}
      {!valid && <p className="text-xs text-muted-foreground">{salary <= 0 ? "Enter your monthly take-home income to continue." : "Check selected item amounts and keep 100 or fewer items."}</p>}
      {step === 1 && available < 0 && <p className="text-xs text-danger">These items exceed your income. Adjust the amounts or income before allocating more money.</p>}
      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <div className="flex gap-2">{step > 0 && <Button type="button" variant="outline" onClick={() => { setError(""); setStep(step - 1); }}>Back</Button>}{step === 0 ? <Button type="button" className="flex-1" disabled={!valid} onClick={() => setStep(1)}>Continue</Button> : step === 1 ? <Button type="button" className="flex-1" disabled={!valid || !extraValid || available < 0} onClick={reviewAllocation}>Review allocation</Button> : <Button type="button" className="flex-1" disabled={!preview} onClick={save}>{pending ? "Saving…" : "Save this budget"}</Button>}</div>
      <Button type="button" variant="ghost" className="w-full" onClick={onClose}>Keep working manually</Button>
    </fieldset>
  </Sheet>;
}
