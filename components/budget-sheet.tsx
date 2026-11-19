"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { formatINR } from "@/lib/format";
import { saveBudgetSheet } from "@/lib/budget-ratio-actions";
import { BUDGET_CATEGORIES, addScheduledEmis, emptyBudgetSheet, rowAmount, rowPercent, sheetTotals, budgetSheetSchema, type BudgetSheet as Plan, type BudgetSheetRow, type SheetLoan } from "@/lib/budget-sheet";

export function BudgetSheet({ initial, salary, loans, loadError = null }: {
  initial: Plan | null; salary: number; loans: SheetLoan[]; loadError?: string | null;
}) {
  const [saved, setSaved] = useState(() => initial ?? addScheduledEmis(emptyBudgetSheet(salary), loans));
  const [draft, setDraft] = useState(saved);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const totals = sheetTotals(draft);
  const validation = budgetSheetSchema.safeParse(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const update = (id: string, patch: Partial<BudgetSheetRow>) => {
    setDraft((p) => ({ ...p, rows: p.rows.map((r) => r.id === id ? { ...r, ...patch } : r) })); setMessage(""); setError("");
  };
  function save() {
    if (!validation.success) return;
    setError("");
    start(async () => {
      try {
        const result = await saveBudgetSheet(draft);
        if (!result.ok) { setError(result.error); return; }
        setSaved(draft); setMessage("Budget saved."); router.refresh();
      } catch { setError("Could not save. Your edits are still here. Try again."); }
    });
  }
  return <section aria-labelledby="budget-sheet-heading" data-guide="budget-sheet" className="space-y-4">
    <div><h2 id="budget-sheet-heading" className="text-lg font-semibold">My monthly budget</h2><p className="text-sm text-muted-foreground">Type an amount or a percentage. The other updates for you.</p></div>
    {loadError && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{loadError}</p>}
    <fieldset disabled={pending || !!loadError} className="min-w-0 space-y-4 disabled:opacity-60">
      <div className="rounded-2xl border bg-card p-4"><Field label="Monthly take-home income" htmlFor="sheet-income"><MoneyInput id="sheet-income" value={draft.salary || null} onChange={(v) => { setDraft((p) => ({ ...p, salary: v ?? 0 })); setMessage(""); }} /></Field></div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_8rem_6rem_2rem] gap-2 border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground sm:grid" aria-hidden><span>Item</span><span>Category</span><span>Amount</span><span>% of income</span><span /></div>
        {draft.rows.length === 0 && <p className="p-5 text-center text-sm text-muted-foreground">Add your first item, such as rent, groceries or savings.</p>}
        {draft.rows.map((row, i) => <div key={row.id} role="group" aria-label={`Budget item ${i + 1}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] items-end gap-2 border-b p-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_8rem_6rem_2rem]">
          <Input aria-label={`Item ${i + 1} name`} placeholder="Item name" maxLength={80} value={row.name} onChange={(e) => update(row.id, { name: e.target.value })} className="min-w-0" />
          <Select aria-label={`${row.name || `Item ${i + 1}`} category`} value={row.category} onChange={(e) => update(row.id, { category: e.target.value as BudgetSheetRow["category"] })} className="min-w-0 text-sm">{Object.entries(BUDGET_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
          <div className="col-start-1 row-start-2 min-w-0 sm:col-start-auto sm:row-auto"><p className="mb-1 text-[11px] text-muted-foreground sm:hidden">Amount</p><MoneyInput aria-label={`${row.name || `Item ${i + 1}`} amount`} value={rowAmount(row, draft.salary)} onChange={(v) => update(row.id, { mode: "amount", value: v ?? 0 })} /></div>
          <div className="col-start-2 row-start-2 min-w-0 sm:col-start-auto sm:row-auto"><p className="mb-1 text-[11px] text-muted-foreground sm:hidden">% of income</p><div className="relative"><Input aria-label={`${row.name || `Item ${i + 1}`} percentage`} type="number" min="0" max="10000" step="0.01" inputMode="decimal" disabled={draft.salary <= 0} value={rowPercent(row, draft.salary)} onChange={(e) => update(row.id, { mode: "percent", value: e.target.value === "" ? 0 : Number(e.target.value) })} className="tabular min-w-0 pr-7 text-right" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span></div></div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${row.name || `item ${i + 1}`}`} onClick={() => { setDraft((p) => ({ ...p, rows: p.rows.filter((r) => r.id !== row.id), excludedLoanIds: row.loanId ? [...new Set([...p.excludedLoanIds, row.loanId])] : p.excludedLoanIds })); setMessage(""); }} className="col-start-3 row-start-1 size-8 sm:col-start-auto sm:row-auto"><Trash2 className="size-4" /></Button>
          {row.loanId && <span className="col-span-3 text-[10px] text-muted-foreground sm:col-span-5">From your loan EMI</span>}
        </div>)}
        <Button type="button" variant="ghost" className="w-full rounded-none" disabled={draft.rows.length >= 100} onClick={() => { setDraft((p) => ({ ...p, rows: [...p.rows, { id: crypto.randomUUID(), name: "", category: "variable", mode: "amount", value: 0, loanId: null }] })); setMessage(""); }}><Plus className="size-4" /> Add item</Button>
      </div>
      <div className="space-y-2 rounded-2xl border bg-card p-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>Total planned</span><span className="tabular font-medium">{formatINR(totals.allocated)} · {totals.percent}%</span></div><div className={`flex flex-wrap justify-between gap-2 font-semibold ${totals.remaining < 0 ? "text-danger" : "text-primary"}`}><span>{totals.remaining < 0 ? "Over budget" : "Money left"}</span><span className="tabular">{formatINR(Math.abs(totals.remaining))}</span></div></div>
      <p className="text-xs text-muted-foreground">When income changes, rupee entries stay fixed and percentage entries resize. Loan EMIs start as fixed expenses. Nothing is saved until you tap Save budget.</p>
      {draft.excludedLoanIds.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((p) => addScheduledEmis({ ...p, excludedLoanIds: [] }, loans))}>Restore removed loan EMIs</Button>}
      <div className="flex gap-2"><Button type="button" className="flex-1" disabled={!validation.success} onClick={save}>{pending ? "Saving…" : "Save budget"}</Button>{dirty && <Button type="button" variant="outline" onClick={() => { setDraft(saved); setError(""); setMessage(""); }}>Undo changes</Button>}</div>
    </fieldset>
    {!validation.success && draft.salary > 0 && <p className="text-sm text-muted-foreground">{validation.error.issues[0]?.message}</p>}
    {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    {message && <p role="status" className="text-sm text-primary">{message}</p>}
  </section>;
}
