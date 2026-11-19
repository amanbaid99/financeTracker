"use client";

import { fillFromRecords, type KnownBudgetCost } from "@/lib/budget-assist";
import { reviewBudget, type BudgetReviewGoal } from "@/lib/budget-insights";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, PiggyBank, Plus, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { BudgetRemainder } from "@/components/budget-remainder";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { formatINR } from "@/lib/format";
import { resetBudgetSheet, saveBudgetSheet, applySheetToPlan } from "@/lib/budget-ratio-actions";
import { cn } from "@/lib/utils";
import { BUDGET_CATEGORIES, EXPENSE_PRESETS, addScheduledEmis, emptyBudgetSheet, rowAmount, rowPercent, sheetTotals, budgetSheetSchema, budgetRowSchema, type BudgetSheet as Plan, type BudgetSheetRow, type SheetLoan } from "@/lib/budget-sheet";

const SECTIONS = [
  { id: "expenses", title: "Expenses", category: "fixed", icon: Wallet, empty: "Rent, bills and everyday spending.", add: "Add expense" },
  { id: "savings", title: "Savings", category: "savings", icon: PiggyBank, empty: "Emergency funds and money for upcoming plans.", add: "Add savings" },
  { id: "investments", title: "Investments", category: "investing", icon: TrendingUp, empty: "Money you plan to invest each month.", add: "Add investment" },
] as const;
type SectionId = typeof SECTIONS[number]["id"];
const sectionFor = (row: BudgetSheetRow): SectionId => row.category === "savings" ? "savings" : row.category === "investing" ? "investments" : "expenses";

function ShareInput({ row, salary, onChange }: { row: BudgetSheetRow; salary: number; onChange: (value: number) => void }) {
  return <div className="relative"><Input aria-label={`${row.name || "Item"} percentage`} type="number" min="0" max="10000" step="0.01" inputMode="decimal" disabled={salary <= 0} value={rowPercent(row, salary)} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className="tabular min-w-0 pr-7 text-right" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span></div>;
}

function ItemEditor({ initial, isNew, section, salary, hasAutomaticEmis, onClose, onApply, onRemove }: {
  initial: BudgetSheetRow; isNew: boolean; section: SectionId; salary: number; hasAutomaticEmis: boolean; onClose: () => void;
  onApply: (row: BudgetSheetRow) => void; onRemove: () => void;
}) {
  const [row, setRow] = useState(initial);
  const [preset, setPreset] = useState(isNew && section === "expenses" ? "" : "custom");
  const heading = SECTIONS.find((s) => s.id === section)!;
  const valid = budgetRowSchema.safeParse(row).success && rowAmount(row, salary) <= 1e9 && (!isNew || section !== "expenses" || preset !== "");
  const categories = Object.entries(BUDGET_CATEGORIES).filter(([value]) => {
    if (!isNew) return true;
    if (section === "expenses") return value !== "savings" && value !== "investing";
    return value === heading.category;
  });
  return <Sheet title={isNew ? heading.add : `Edit ${initial.name}`} onClose={onClose}>
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) onApply({ ...row, name: row.name.trim() }); }}>
      {isNew && section === "expenses" && <Field label="Expense" htmlFor="budget-expense-preset" hint={hasAutomaticEmis ? "Your tracked loan EMIs are already included under Fixed costs." : undefined}><Select id="budget-expense-preset" value={preset} onChange={(e) => {
        const selected = EXPENSE_PRESETS.find((p) => p.value === e.target.value);
        setPreset(e.target.value);
        setRow((r) => ({ ...r, name: selected?.name ?? "", category: selected?.category ?? "fixed" }));
      }}><option value="" disabled>Choose an expense</option>{EXPENSE_PRESETS.map((p) => <option key={p.value} value={p.value} disabled={p.value === "emi" && hasAutomaticEmis}>{p.name}{p.value === "emi" && hasAutomaticEmis ? " (already included)" : ""}</option>)}<option value="custom">Custom</option></Select></Field>}
      {(!isNew || section !== "expenses" || preset === "custom") && <Field label="Name" htmlFor="budget-item-name"><Input id="budget-item-name" maxLength={80} placeholder={section === "expenses" ? "e.g. Rent" : section === "savings" ? "e.g. Emergency fund" : "e.g. Monthly investment"} value={row.name} onChange={(e) => setRow((r) => ({ ...r, name: e.target.value }))} /></Field>}
      {(!isNew || (section === "expenses" && preset === "custom")) && <Field label="Type" htmlFor="budget-item-type"><Select id="budget-item-type" value={row.category} onChange={(e) => setRow((r) => ({ ...r, category: e.target.value as BudgetSheetRow["category"] }))}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>}
      {isNew && section === "expenses" && preset && preset !== "custom" && <p className="text-xs text-muted-foreground">{row.category === "fixed" ? "Added under Fixed costs." : "Added under Variable & other expenses."}</p>}
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3"><Field label="Monthly amount" htmlFor="budget-item-amount"><MoneyInput id="budget-item-amount" value={rowAmount(row, salary)} onChange={(value) => setRow((r) => ({ ...r, mode: "amount", value: value ?? 0 }))} /></Field><div className="space-y-1.5"><p className="text-sm font-medium">% of income</p><ShareInput row={row} salary={salary} onChange={(value) => setRow((r) => ({ ...r, mode: "percent", value }))} /></div></div>
      <p className="text-xs text-muted-foreground">Enter an amount or a percentage; the other updates by itself. Tap Save at the bottom to keep your changes.</p>
      <Button type="submit" className="w-full" disabled={!valid}>{isNew ? heading.add : "Update item"}</Button>
      {!isNew && <Button type="button" variant="ghost" className="w-full text-danger" onClick={onRemove}>Remove item</Button>}
    </form>
  </Sheet>;
}

const COLORS: Record<string, string> = {
  fixed: "bg-slate-500", variable: "bg-amber-500", investing: "bg-primary",
  savings: "bg-sky-500", debt: "bg-violet-500", personal: "bg-pink-500", remaining: "bg-muted-foreground/25",
};
const pct = (n: number, of: number) => (of > 0 ? `${(n / of * 100).toFixed(1).replace(/\.0$/, "")}%` : "");

/**
 * The budget: income, one top card (where it goes, what's left and what to
 * do about it), then expenses, savings and investments as simple rows. Tap a
 * row to change it. Changes stay a draft until Save in the bar at the bottom.
 */
export function BudgetSheet({ initial, saved: hasSaved = true, salary, loans, goals = [], knownCosts = [], recordedSips = 0, planMonthly = null, loadError = null }: {
  initial: Plan | null; saved?: boolean; salary: number; loans: SheetLoan[]; goals?: BudgetReviewGoal[]; knownCosts?: KnownBudgetCost[]; recordedSips?: number; planMonthly?: number | null; loadError?: string | null;
}) {
  const start0 = initial ?? addScheduledEmis(emptyBudgetSheet(salary), loans);
  const [saved, setSaved] = useState(start0);
  // A new budget starts from what the app already knows, as a draft to review.
  const [draft, setDraft] = useState(() => hasSaved ? start0 : fillFromRecords(start0, knownCosts, loans, recordedSips));
  const [editor, setEditor] = useState<{ row: BudgetSheetRow; isNew: boolean; section: SectionId } | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [resetError, setResetError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const totals = sheetTotals(draft);
  const validation = budgetSheetSchema.safeParse(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved) || !hasSaved && !message;
  // Don't lose edits by leaving the page.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
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
        setSaved(draft); setMessage("Budget saved. Your plan and goals now use it."); router.refresh();
      } catch { setError("Could not save. Your edits are still here. Try again."); }
    });
  }
  function applyToPlan() {
    setError("");
    start(async () => {
      const result = await applySheetToPlan();
      if (!result.ok) { setError(result.error); return; }
      setMessage(`Your plan now uses ${formatINR(result.monthly)} a month.`); router.refresh();
    });
  }
  function reset() {
    setResetError("");
    start(async () => {
      try {
        const result = await resetBudgetSheet("RESET_BUDGET");
        if (!result.ok) { setResetError(result.error); return; }
        const fresh = addScheduledEmis(emptyBudgetSheet(salary), loans);
        setSaved(fresh); setDraft(fillFromRecords(fresh, knownCosts, loans, recordedSips)); setEditor(null); setError(""); setShowReset(false);
        setMessage("Budget reset. It starts again from your records; review and save."); router.refresh();
      } catch { setResetError("Could not reset your budget. Try again."); }
    });
  }
  const newRow = (section: SectionId, category: BudgetSheetRow["category"], value = 0): BudgetSheetRow => ({ id: crypto.randomUUID(), name: section === "savings" ? "Savings" : section === "investments" ? "Investing" : "", category, mode: "amount", value, loanId: null });
  const openNew = (section: SectionId, value = 0) => {
    const sec = SECTIONS.find((s) => s.id === section)!;
    setEditor({ row: newRow(section, sec.category, value), isNew: true, section });
  };
  const fill = () => { setDraft((p) => fillFromRecords(p, knownCosts, loans, recordedSips)); setMessage(""); };
  const canFill = JSON.stringify(fillFromRecords(draft, knownCosts, loans, recordedSips).rows) !== JSON.stringify(draft.rows);

  // Top card numbers.
  const review = reviewBudget(draft, goals);
  const future = draft.rows.filter((r) => r.category === "savings" || r.category === "investing").reduce((s, r) => s + rowAmount(r, draft.salary), 0);
  const need = Math.ceil(goals.filter((g) => g.status !== "reached" && !g.isLoan).reduce((s, g) => s + Math.max(0, g.monthlySip) + Math.max(0, g.extraSipNeeded), 0));
  const expenses = draft.rows.filter((r) => sectionFor(r) === "expenses");
  const biggest = [...expenses].sort((a, b) => rowAmount(b, draft.salary) - rowAmount(a, draft.salary))[0];

  const renderRow = (row: BudgetSheetRow) => (
    <li key={row.id}>
      <button type="button" aria-label={`Edit ${row.name}`} onClick={() => setEditor({ row, isNew: false, section: sectionFor(row) })} className="press flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40">
        <span className="min-w-0">
          <span className="block break-words text-sm font-medium">{row.name}</span>
          {(sectionFor(row) === "expenses" || row.loanId) && <span className="block text-[11px] text-muted-foreground">{BUDGET_CATEGORIES[row.category]}{row.loanId ? " · Loan EMI" : ""}</span>}
        </span>
        <span className="shrink-0 text-right">
          <span className="tabular block text-sm font-medium">{formatINR(rowAmount(row, draft.salary))}</span>
          {draft.salary > 0 && <span className="tabular block text-[11px] text-muted-foreground">{pct(rowAmount(row, draft.salary), draft.salary)}</span>}
        </span>
      </button>
    </li>
  );

  return <section aria-label="Your budget" data-guide="budget-sheet" className="space-y-4 pb-20">
    {loadError && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{loadError}</p>}
    <fieldset disabled={pending || !!loadError} className="min-w-0 space-y-4 disabled:opacity-60">
      <section aria-label="Your month" className="surface-card space-y-4 rounded-2xl border bg-card p-4">
        <Field label="Monthly take-home income" htmlFor="sheet-income"><MoneyInput id="sheet-income" value={draft.salary || null} onChange={(v) => { setDraft((p) => ({ ...p, salary: v ?? 0 })); setMessage(""); }} /></Field>
        {review.slices.length > 0 && <>
          <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted">{review.slices.map((sl) => <span key={sl.key} className={cn("h-full", COLORS[sl.key])} style={{ width: `${sl.width}%` }} />)}</div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">{review.slices.map((sl) => <li key={sl.key} className="flex items-center gap-1"><span className={cn("size-2 rounded-full", COLORS[sl.key])} aria-hidden />{sl.label} <span className="tabular font-medium text-foreground">{formatINR(sl.amount)}</span></li>)}</ul>
        </>}
        <div className="border-t pt-3">
          {draft.salary <= 0 ? <p className="text-sm text-muted-foreground">Add your take-home income to start.</p>
          : totals.remaining > 0 ? <>
            <p className="font-semibold"><span className="tabular">{formatINR(totals.remaining)}</span> not assigned yet</p>
            <BudgetRemainder key={JSON.stringify(draft)} plan={draft} onApply={(plan) => { setDraft(plan); setMessage(""); setError(""); }} />
          </> : totals.remaining < 0 ? <>
            <p className="font-semibold text-danger"><span className="tabular">{formatINR(-totals.remaining)}</span> more than you earn</p>
            {biggest && <p className="text-xs text-muted-foreground">Biggest cost: {biggest.name}, {formatINR(rowAmount(biggest, draft.salary))}. <button type="button" className="font-medium text-primary underline" onClick={() => setEditor({ row: biggest, isNew: false, section: "expenses" })}>Change it</button></p>}
          </> : <p className="font-semibold text-success">Every rupee has a place.</p>}
        </div>
        {(need > 0 || future > 0) && <div className="space-y-2 rounded-xl bg-muted/50 p-3 text-sm">
          <p>{need > 0 ? <>Your goals need about <b className="tabular">{formatINR(need)}</b> a month. </> : null}This budget sets aside <b className="tabular">{formatINR(future)}</b> for savings and investing.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {future > 0 && !dirty && planMonthly !== future && <Button type="button" size="sm" className="min-h-10" onClick={applyToPlan}>Use {formatINR(future)} for Your plan</Button>}
            <Link href="/goals/plan" className="inline-flex min-h-10 items-center gap-0.5 text-xs font-medium text-primary">Your plan <ChevronRight className="size-3.5" aria-hidden /></Link>
          </div>
        </div>}
      </section>

      {SECTIONS.map((section) => {
        const rows = draft.rows.filter((row) => sectionFor(row) === section.id).sort((a, b) => rowAmount(b, draft.salary) - rowAmount(a, draft.salary));
        const amount = rows.reduce((sum, row) => sum + rowAmount(row, draft.salary), 0);
        const Icon = section.icon;
        return <section key={section.id} aria-labelledby={`budget-${section.id}`} className="overflow-hidden rounded-2xl border bg-card">
          <header className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon className="size-4" aria-hidden /></span>
            <h3 id={`budget-${section.id}`} className="min-w-0 flex-1 font-semibold">{section.title}</h3>
            <span className="tabular text-right text-sm font-semibold">{formatINR(amount)}{draft.salary > 0 && <span className="block text-[11px] font-normal text-muted-foreground">{pct(amount, draft.salary)} of income</span>}</span>
          </header>
          {rows.length ? <ul className="divide-y border-t">{rows.map(renderRow)}</ul> : <p className="border-t px-4 py-3 text-sm text-muted-foreground">{section.empty}</p>}
          <Button type="button" variant="ghost" className="min-h-11 w-full rounded-none border-t text-primary" disabled={draft.rows.length >= 100} onClick={() => openNew(section.id)}><Plus className="size-4" /> {section.add}</Button>
        </section>;
      })}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {canFill ? <Button type="button" variant="ghost" size="sm" onClick={fill}><RefreshCw className="size-4" /> Fill from my records</Button> : <span />}
        {draft.excludedLoanIds.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((p) => addScheduledEmis({ ...p, excludedLoanIds: [] }, loans))}>Restore removed loan EMIs</Button>}
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setResetError(""); setShowReset(true); }}>Reset budget</Button>
      </div>
    </fieldset>
    {!validation.success && draft.salary > 0 && <p className="text-sm text-muted-foreground">{validation.error.issues[0]?.message}</p>}
    {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    {message && <p role="status" className="text-sm text-primary">{message}</p>}

    {dirty && !loadError && <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 pl-4 pr-20">
      <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border bg-card p-2 pl-4 pr-2 shadow-lg sm:pr-2">
        <p className="min-w-0 flex-1 text-sm font-medium">{hasSaved ? "Unsaved changes" : "Review, then save"}</p>
        {hasSaved && <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => { setDraft(saved); setError(""); setMessage(""); }}>Undo</Button>}
        <Button type="button" size="sm" className="min-h-10" disabled={pending || !validation.success} onClick={save}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </div>}

    {showReset && <Sheet title="Reset budget?" onClose={() => { if (!pending) { setShowReset(false); setResetError(""); } }}>
      <div className="space-y-4">
        <p className="text-sm">This removes your saved budget and unsaved edits. It cannot be undone.</p>
        <p className="text-sm text-muted-foreground">A fresh budget starts from your income, costs, loan EMIs and SIPs, for you to review and save. Your loans, investments, goals and cards stay as they are.</p>
        {resetError && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{resetError}</p>}
        <Button type="button" variant="destructive" className="w-full" disabled={pending} onClick={reset}>{pending ? "Resetting…" : "Reset and start over"}</Button>
        <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => setShowReset(false)}>Keep my budget</Button>
      </div>
    </Sheet>}
    {editor && <ItemEditor key={editor.row.id} initial={editor.row} isNew={editor.isNew} section={editor.section} salary={draft.salary} hasAutomaticEmis={draft.rows.some((r) => !!r.loanId)} onClose={() => setEditor(null)} onRemove={() => remove(editor.row)} onApply={(row) => {
      setDraft((p) => ({ ...p, rows: editor.isNew ? [...p.rows, row] : p.rows.map((r) => r.id === row.id ? row : r) }));
      setEditor(null); setError(""); setMessage("");
    }} />}
  </section>;
}
