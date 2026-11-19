"use client";

import { BudgetAllocation } from "@/components/budget-allocation";
import type { BudgetReviewGoal } from "@/lib/budget-insights";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, PiggyBank, Plus, TrendingUp, Wallet } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { formatINR } from "@/lib/format";
import { saveBudgetSheet } from "@/lib/budget-ratio-actions";
import { BUDGET_CATEGORIES, addScheduledEmis, emptyBudgetSheet, rowAmount, rowPercent, sheetTotals, budgetSheetSchema, budgetRowSchema, type BudgetSheet as Plan, type BudgetSheetRow, type SheetLoan } from "@/lib/budget-sheet";

const SECTIONS = [
  { id: "expenses", title: "Expenses", category: "variable", icon: Wallet, empty: "Rent, bills and everyday spending.", add: "Add expense" },
  { id: "savings", title: "Savings", category: "savings", icon: PiggyBank, empty: "Emergency funds and money for upcoming plans.", add: "Add savings" },
  { id: "investments", title: "Investments", category: "investing", icon: TrendingUp, empty: "Money you plan to invest each month.", add: "Add investment" },
] as const;
type SectionId = typeof SECTIONS[number]["id"];
const sectionFor = (row: BudgetSheetRow): SectionId => row.category === "savings" ? "savings" : row.category === "investing" ? "investments" : "expenses";

function ShareInput({ row, salary, onChange }: { row: BudgetSheetRow; salary: number; onChange: (value: number) => void }) {
  return <div className="relative"><Input aria-label={`${row.name || "Item"} percentage`} type="number" min="0" max="10000" step="0.01" inputMode="decimal" disabled={salary <= 0} value={rowPercent(row, salary)} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className="tabular min-w-0 pr-7 text-right" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span></div>;
}

function ItemEditor({ initial, isNew, section, salary, onClose, onApply, onRemove }: {
  initial: BudgetSheetRow; isNew: boolean; section: SectionId; salary: number; onClose: () => void;
  onApply: (row: BudgetSheetRow) => void; onRemove: () => void;
}) {
  const [row, setRow] = useState(initial);
  const heading = SECTIONS.find((s) => s.id === section)!;
  const valid = budgetRowSchema.safeParse(row).success && rowAmount(row, salary) <= 1e9;
  const categories = Object.entries(BUDGET_CATEGORIES).filter(([value]) => {
    if (!isNew) return true;
    if (section === "expenses") return value !== "savings" && value !== "investing";
    return value === heading.category;
  });
  return <Sheet title={isNew ? heading.add : `Edit ${initial.name}`} onClose={onClose}>
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) onApply({ ...row, name: row.name.trim() }); }}>
      <Field label="Name" htmlFor="budget-item-name"><Input id="budget-item-name" maxLength={80} placeholder={section === "expenses" ? "e.g. Rent" : section === "savings" ? "e.g. Emergency fund" : "e.g. Monthly investment"} value={row.name} onChange={(e) => setRow((r) => ({ ...r, name: e.target.value }))} /></Field>
      {(!isNew || section === "expenses") && <Field label="Type" htmlFor="budget-item-type"><Select id="budget-item-type" value={row.category} onChange={(e) => setRow((r) => ({ ...r, category: e.target.value as BudgetSheetRow["category"] }))}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>}
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3"><Field label="Monthly amount" htmlFor="budget-item-amount"><MoneyInput id="budget-item-amount" value={rowAmount(row, salary)} onChange={(value) => setRow((r) => ({ ...r, mode: "amount", value: value ?? 0 }))} /></Field><div className="space-y-1.5"><p className="text-sm font-medium">% of income</p><ShareInput row={row} salary={salary} onChange={(value) => setRow((r) => ({ ...r, mode: "percent", value }))} /></div></div>
      <p className="text-xs text-muted-foreground">Enter an amount or a percentage. The other updates automatically. This updates your draft; Save budget keeps it.</p>
      <Button type="submit" className="w-full" disabled={!valid}>{isNew ? heading.add : "Update item"}</Button>
      {!isNew && <Button type="button" variant="ghost" className="w-full text-danger" onClick={onRemove}>Remove item</Button>}
    </form>
  </Sheet>;
}

export function BudgetSheet({ initial, salary, loans, goals = [], loadError = null }: {
  initial: Plan | null; salary: number; loans: SheetLoan[]; goals?: BudgetReviewGoal[]; loadError?: string | null;
}) {
  const [saved, setSaved] = useState(() => initial ?? addScheduledEmis(emptyBudgetSheet(salary), loans));
  const [draft, setDraft] = useState(saved);
  const [editor, setEditor] = useState<{ row: BudgetSheetRow; isNew: boolean; section: SectionId } | null>(null);
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
  const remove = (row: BudgetSheetRow) => {
    setDraft((p) => ({ ...p, rows: p.rows.filter((r) => r.id !== row.id), excludedLoanIds: row.loanId ? [...new Set([...p.excludedLoanIds, row.loanId])] : p.excludedLoanIds }));
    setEditor(null); setMessage(""); setError("");
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
    <div><h2 id="budget-sheet-heading" className="text-lg font-semibold">My monthly budget</h2><p className="text-sm text-muted-foreground">Expenses, savings and investments, all in one place.</p></div>
    {loadError && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{loadError}</p>}
    <fieldset disabled={pending || !!loadError} className="min-w-0 space-y-4 disabled:opacity-60">
      <div className="rounded-2xl border bg-card p-4"><Field label="Monthly take-home income" htmlFor="sheet-income"><MoneyInput id="sheet-income" value={draft.salary || null} onChange={(v) => { setDraft((p) => ({ ...p, salary: v ?? 0 })); setMessage(""); }} /></Field></div>
      <BudgetAllocation plan={draft} goals={goals} />
      <div className="space-y-4">{SECTIONS.map((section) => {
        const rows = draft.rows.filter((row) => sectionFor(row) === section.id);
        const amount = rows.reduce((sum, row) => sum + rowAmount(row, draft.salary), 0);
        const Icon = section.icon;
        return <section key={section.id} aria-labelledby={`budget-${section.id}`} className="overflow-hidden rounded-2xl border bg-card">
          <header className="flex items-center gap-3 px-4 py-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon className="size-4" aria-hidden /></span>
            <h3 id={`budget-${section.id}`} className="min-w-0 flex-1 break-words font-semibold">{section.title}</h3>
            <div className="min-w-0 max-w-[45%] text-right"><p className="tabular break-words text-sm font-semibold">{formatINR(amount)}</p>{draft.salary > 0 && <p className="tabular text-[11px] text-muted-foreground">{(amount / draft.salary * 100).toFixed(1).replace(/\.0$/, "")}% of income</p>}</div>
          </header>
          {rows.length ? <ul className="divide-y border-t">{rows.map((row) => <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-x-2 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_6rem_2.75rem]">
            <div className="col-span-2 flex items-start gap-2 sm:contents">
              <div className="min-w-0 flex-1 sm:col-start-1 sm:row-start-1"><p className="break-words text-sm font-medium">{row.name}</p>{(section.id === "expenses" || row.loanId) && <p className="mt-0.5 text-[11px] text-muted-foreground">{BUDGET_CATEGORIES[row.category]}{row.loanId ? " · Loan EMI" : ""}</p>}</div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${row.name}`} onClick={() => setEditor({ row, isNew: false, section: section.id })} className="size-11 shrink-0 sm:col-start-4 sm:row-start-1"><Pencil className="size-4" /></Button>
            </div>
            <div className="col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1"><MoneyInput aria-label={`${row.name} amount`} value={rowAmount(row, draft.salary)} onChange={(value) => update(row.id, { mode: "amount", value: value ?? 0 })} /></div>
            <div className="col-start-2 row-start-2 min-w-0 sm:col-start-3 sm:row-start-1"><ShareInput row={row} salary={draft.salary} onChange={(value) => update(row.id, { mode: "percent", value })} /></div>
          </li>)}</ul> : <p className="px-4 pb-3 text-sm text-muted-foreground">{section.empty}</p>}
          <Button type="button" variant="ghost" className="min-h-11 w-full rounded-none border-t text-primary" disabled={draft.rows.length >= 100} onClick={() => setEditor({ row: { id: crypto.randomUUID(), name: "", category: section.category, mode: "amount", value: 0, loanId: null }, isNew: true, section: section.id })}><Plus className="size-4" /> {section.add}</Button>
        </section>;
      })}</div>
      <div className="space-y-2 rounded-2xl border bg-card p-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>Total planned</span><span className="tabular font-medium">{formatINR(totals.allocated)} · {totals.percent}%</span></div><div className={`flex flex-wrap justify-between gap-2 font-semibold ${totals.remaining < 0 ? "text-danger" : "text-primary"}`}><span>{totals.remaining < 0 ? "Over budget" : "Money left"}</span><span className="tabular">{formatINR(Math.abs(totals.remaining))}</span></div></div>
      <p className="text-xs text-muted-foreground">When income changes, rupee entries stay fixed and percentage entries resize. Loan EMIs start as fixed expenses. Nothing is saved until you tap Save budget.</p>
      {draft.excludedLoanIds.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((p) => addScheduledEmis({ ...p, excludedLoanIds: [] }, loans))}>Restore removed loan EMIs</Button>}
      <div className="flex gap-2"><Button type="button" className="flex-1" disabled={!validation.success} onClick={save}>{pending ? "Saving…" : "Save budget"}</Button>{dirty && <Button type="button" variant="outline" onClick={() => { setDraft(saved); setError(""); setMessage(""); }}>Undo changes</Button>}</div>
    </fieldset>
    {!validation.success && draft.salary > 0 && <p className="text-sm text-muted-foreground">{validation.error.issues[0]?.message}</p>}
    {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    {message && <p role="status" className="text-sm text-primary">{message}</p>}
    {editor && <ItemEditor key={editor.row.id} initial={editor.row} isNew={editor.isNew} section={editor.section} salary={draft.salary} onClose={() => setEditor(null)} onRemove={() => remove(editor.row)} onApply={(row) => {
      setDraft((p) => ({ ...p, rows: editor.isNew ? [...p.rows, row] : p.rows.map((r) => r.id === row.id ? row : r) }));
      setEditor(null); setError(""); setMessage("");
    }} />}
  </section>;
}
