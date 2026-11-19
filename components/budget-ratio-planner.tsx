"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/money-input";
import { Field } from "@/components/forms/field";
import { Sheet } from "@/components/sheet";
import { formatINR } from "@/lib/format";
import { saveRatioPlan } from "@/lib/budget-ratio-actions";
import {
  BUCKET_KINDS, approvedEmis, emiKey, basisTotal, defaultRatioPlan, ratioPlanSchema,
  ratioWarnings, splitRupees, suggestChildren, suggestRatioPlan,
  type RatioPlan, type RatioBucket, type RatioContext,
} from "@/lib/budget-ratios";

const COLORS = ["bg-foreground/50", "bg-primary", "bg-warning", "bg-sky-600", "bg-violet-500"];
function PercentInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return <div className="relative w-24 shrink-0">
    <Input aria-label={label} type="number" min="0" max="100" step="0.01" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className="tabular pr-7 text-right" />
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
  </div>;
}

export function BudgetRatioPlanner({ initial, salary, context, loadError = null }: {
  initial: RatioPlan | null; salary: number; context: RatioContext; loadError?: string | null;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState<RatioPlan>(() => initial ?? defaultRatioPlan(salary));
  const [editing, setEditing] = useState(!initial);
  const [step, setStep] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [showEmis, setShowEmis] = useState(false);
  const [emiSelection, setEmiSelection] = useState<string[]>([]);
  const [beforeSuggestion, setBeforeSuggestion] = useState<RatioPlan | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const plan = editing ? draft : saved ?? draft;
  const total = basisTotal(plan.buckets) / 100;
  const amounts = splitRupees(plan.salary, plan.buckets.map((b) => b.percent));
  const valid = ratioPlanSchema.safeParse(plan);
  const selectedEmis = approvedEmis(plan, context);
  const emiTotal = selectedEmis.reduce((sum, l) => sum + l.emi, 0);
  const detectedEmis = context.loanEmis.reduce((sum, l) => sum + l.emi, 0);
  const warnings = total === 100 ? ratioWarnings(plan, context) : [];
  const activeIndex = plan.buckets.findIndex((b) => b.id === active);
  const bucket = plan.buckets[activeIndex];
  const change = (id: string, patch: Partial<RatioBucket>) => {
    setDraft((p) => ({ ...p, buckets: p.buckets.map((b) => b.id === id ? { ...b, ...patch } : b) }));
    setMessage(""); setError(""); setBeforeSuggestion(null);
  };
  const suggest = () => {
    const result = suggestRatioPlan(draft.salary, context, draft.includedEmiIds);
    setBeforeSuggestion(draft); setDraft(result.plan); setReasons(result.reasons); setError("");
    setMessage("Suggested split ready. Adjust anything you like.");
  };
  function save() {
    if (!valid.success) { setError(valid.error.issues[0]?.message ?? "Check the ratios."); return; }
    setError("");
    start(async () => {
      try {
        const result = await saveRatioPlan(draft);
        if (!result.ok) { setError(result.error); return; }
        setBeforeSuggestion(null); setSaved(draft); setEditing(false); setMessage("Budget saved."); router.refresh();
      } catch { setError("Could not save. Your edits are still here. Try again."); }
    });
  }
  function addBucket() {
    const id = crypto.randomUUID();
    setDraft((p) => ({ ...p, buckets: [...p.buckets, { id, label: "New bucket", kind: "custom", percent: 0, children: [] }] }));
    setActive(id);
  }
  const overview = <div className="overflow-hidden rounded-2xl border bg-card">
    {plan.buckets.map((b, i) => <div key={b.id} className="border-b last:border-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`size-2 shrink-0 rounded-full ${COLORS[i % COLORS.length]}`} aria-hidden />
        <button type="button" onClick={() => setActive(b.id)} className="min-w-0 flex-1 py-1 text-left" aria-label={`${editing ? "Edit" : "View"} ${b.label}`}>
          <span className="flex items-center gap-1"><span className="break-words text-sm font-medium">{b.label}</span><ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden /></span>
          <span className="tabular text-xs text-muted-foreground">{total > 100 ? "Check ratios" : formatINR(amounts[i])}{b.children.length ? ` · ${b.children.length} allocation${b.children.length === 1 ? "" : "s"}` : ""}</span>
        </button>
        {editing && step === 1 ? <PercentInput label={`${b.label} salary percentage`} value={b.percent} onChange={(percent) => change(b.id, { percent })} /> : <span className="tabular text-sm text-muted-foreground">{b.percent}%</span>}
      </div>
    </div>)}
  </div>;

  return <section aria-labelledby="ratio-budget-heading" data-guide="ratio-budget" className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div><h2 id="ratio-budget-heading" className="text-lg font-semibold">Plan my budget</h2><p className="text-sm text-muted-foreground">Your salary, split your way.</p></div>
      {!editing && <Button variant="outline" size="sm" disabled={!!loadError} onClick={() => { setDraft(saved!); setStep(0); setEditing(true); setMessage(""); }}>Edit budget</Button>}
    </div>
    {loadError && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{loadError}</p>}
    <fieldset disabled={pending || !!loadError} className="min-w-0 space-y-4 disabled:opacity-60">
      {editing && <ol aria-label="Budget steps" className="flex gap-2 text-xs">{["Salary", "Split", "Review"].map((name, i) => <li key={name} aria-current={i === step ? "step" : undefined} className={`flex-1 rounded-full px-3 py-2 text-center ${i === step ? "bg-primary-soft font-medium text-primary" : "bg-muted text-muted-foreground"}`}>{i + 1}. {name}</li>)}</ol>}
      {(!editing || step !== 0) && <div className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">Monthly take-home</p><p className="tabular text-2xl font-semibold">{formatINR(plan.salary)}</p></div>{editing && <Button type="button" variant="ghost" size="sm" onClick={() => setStep(0)}>Change</Button>}</div>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>{total <= 100 && plan.buckets.map((b, i) => <span key={b.id} className={COLORS[i % COLORS.length]} style={{ width: `${b.percent}%` }} />)}</div>
        <p className={`tabular text-sm ${total > 100 ? "text-danger" : "text-muted-foreground"}`}>{total === 100 ? "100% allocated" : total < 100 ? `${(100 - total).toFixed(2).replace(/\.00$/, "")}% left to assign` : `${(total - 100).toFixed(2).replace(/\.00$/, "")}% over budget`}</p>
      </div>}
      {editing && step === 0 && <>
        <div className="space-y-3 rounded-2xl border bg-card p-4"><h3 className="font-medium">What do you take home each month?</h3><Field label="Monthly take-home salary" htmlFor="ratio-salary" hint="The amount that reaches your bank account."><MoneyInput id="ratio-salary" value={draft.salary || null} onChange={(v) => { setDraft((p) => ({ ...p, salary: v ?? 0 })); setMessage(""); }} /></Field></div>
        {context.loanEmis.length > 0 && <div className="space-y-3 rounded-2xl border bg-card p-4">
          <div><h3 className="text-sm font-medium">Include your loan EMIs?</h3><p className="mt-1 text-sm text-muted-foreground">{emiTotal ? `${formatINR(emiTotal)} a month selected.` : `We found ${formatINR(detectedEmis)} a month in loan EMIs.`} They are only included if you choose them.</p></div>
          <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { setEmiSelection(draft.includedEmiIds ?? []); setShowEmis(true); }}>{emiTotal ? "Change selected EMIs" : "Choose EMIs"}</Button>{emiTotal > 0 && <Button type="button" size="sm" variant="ghost" onClick={() => { setDraft((p) => ({ ...p, includedEmiIds: [] })); setMessage("EMIs excluded from future suggestions. Review your split next."); }}>Leave EMIs out</Button>}</div>
          {!emiTotal && <p className="text-xs text-muted-foreground">Leave them out by continuing without selecting any.</p>}
        </div>}
      </>}
      {editing && step === 1 && <>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">How would you split it?</h3><Button type="button" variant="outline" size="sm" onClick={suggest}><Sparkles className="size-4" /> Suggest a split</Button></div>
        <p className="text-xs text-muted-foreground">Adjust percentages to total 100%. Tap a bucket for its name and smaller allocations.</p>
        {beforeSuggestion && <Button type="button" size="sm" variant="ghost" onClick={() => { setDraft(beforeSuggestion); setBeforeSuggestion(null); setReasons([]); setMessage("Previous split restored."); }}>Undo suggested split</Button>}
      </>}
      {(!editing || step > 0) && overview}
      {editing && step === 1 && <Button type="button" variant="ghost" className="w-full" disabled={draft.buckets.length >= 12} onClick={addBucket}><Plus className="size-4" /> Add a bucket</Button>}
      {editing && step === 1 && reasons.length > 0 && <details className="text-sm"><summary className="cursor-pointer text-primary">Why this split?</summary><ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">{reasons.map((r) => <li key={r}>{r}</li>)}</ul></details>}
      {(!editing || step === 2) && <>
        <p className="text-sm text-muted-foreground">{emiTotal ? `${formatINR(emiTotal)} in monthly EMIs selected for suggestions.` : "Loan EMIs are not linked to this budget."} Your saved ratios are the amounts planned.</p>
        {warnings.length > 0 && <div className="space-y-1 rounded-xl bg-warning-soft p-3 text-sm" role="status">{warnings.map((w) => <p key={w}>{w}</p>)}</div>}
        <p className="text-xs text-muted-foreground">Saving keeps your budget plan. It does not change your income records, SIPs or loan payments. Not investment advice.</p>
      </>}
      {editing && <div className="flex gap-2">
        {step > 0 && <Button type="button" variant="outline" onClick={() => { setStep(step - 1); setMessage(""); }}><ArrowLeft className="size-4" /> Back</Button>}
        {step < 2 ? <Button type="button" className="flex-1" disabled={step === 0 ? !Number.isSafeInteger(draft.salary) || draft.salary <= 0 || draft.salary > 1e9 : !valid.success} onClick={() => { setStep(step + 1); setMessage(""); }}>{step === 0 ? "Continue to split" : "Review budget"}</Button> : <Button type="button" className="flex-1" onClick={save} disabled={!valid.success}>{pending ? "Saving…" : "Save budget"}</Button>}
      </div>}
      {editing && saved && <Button type="button" variant="ghost" className="w-full" onClick={() => { setDraft(saved); setEditing(false); setActive(null); setBeforeSuggestion(null); setError(""); setReasons([]); setMessage(""); }}>Cancel changes</Button>}
    </fieldset>
    {editing && step >= 1 && !valid.success && <p className="text-sm text-muted-foreground">{valid.error.issues[0]?.message}</p>}
    {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    {message && <p role="status" className="text-sm text-primary">{message}</p>}

    {showEmis && <Sheet title="Choose EMIs to include" onClose={() => setShowEmis(false)}><div className="space-y-4">
      <p className="text-sm text-muted-foreground">Select only the loans you want this budget to cover.</p>
      <div className="divide-y">{context.loanEmis.map((loan) => <label key={emiKey(loan)} className="flex min-h-14 cursor-pointer items-center gap-3 py-3"><input type="checkbox" checked={emiSelection.includes(emiKey(loan))} onChange={(e) => setEmiSelection((ids) => e.target.checked ? [...ids, emiKey(loan)] : ids.filter((id) => id !== emiKey(loan)))} className="size-5 accent-primary" /><span className="min-w-0 flex-1 break-words text-sm">{loan.name}</span><span className="tabular shrink-0 text-sm">{formatINR(loan.emi)}</span></label>)}</div>
      <Button type="button" className="w-full" onClick={() => { setDraft((p) => ({ ...p, includedEmiIds: emiSelection })); setShowEmis(false); setMessage("Selection ready. Review your split next; nothing is saved yet."); }}>Use selected EMIs</Button>
    </div></Sheet>}
    {bucket && <Sheet title={`${editing ? "Edit" : "View"} ${bucket.label}`} onClose={() => setActive(null)}><div className="space-y-4">
      {editing && <><Field label="Bucket name" htmlFor="ratio-bucket-name"><Input id="ratio-bucket-name" value={bucket.label} maxLength={60} onChange={(e) => change(bucket.id, { label: e.target.value })} /></Field><details><summary className="cursor-pointer text-sm text-primary">More options</summary><div className="mt-3 space-y-3"><Field label="Bucket purpose" htmlFor="ratio-purpose"><Select id="ratio-purpose" value={bucket.kind} onChange={(e) => change(bucket.id, { kind: e.target.value as RatioBucket["kind"] })}>{Object.entries(BUCKET_KINDS).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</Select></Field><Button type="button" size="sm" variant="ghost" onClick={() => { setDraft((p) => ({ ...p, buckets: p.buckets.filter((b) => b.id !== bucket.id) })); setActive(null); }}><Trash2 className="size-4" /> Remove bucket</Button></div></details></>}
      <div><p className="tabular text-xl font-semibold">{formatINR(amounts[activeIndex])} a month</p><p className="mt-1 text-sm text-muted-foreground">Smaller allocations are optional. Their percentages share this bucket, not your salary.</p></div>
      {bucket.children.map((child, i) => <div key={child.id} className="space-y-2 rounded-xl border p-3">
        <div className="flex items-center gap-2">{editing ? <Input aria-label={`Allocation ${i + 1} name`} value={child.label} maxLength={60} onChange={(e) => change(bucket.id, { children: bucket.children.map((c) => c.id === child.id ? { ...c, label: e.target.value } : c) })} className="min-w-0 flex-1" /> : <span className="min-w-0 flex-1 break-words text-sm">{child.label}</span>}{editing ? <PercentInput label={`${child.label || `Allocation ${i + 1}`} share of ${bucket.label}`} value={child.percent} onChange={(percent) => change(bucket.id, { children: bucket.children.map((c) => c.id === child.id ? { ...c, percent } : c) })} /> : <span className="text-sm">{child.percent}%</span>}</div>
        <div className="flex items-center justify-between gap-2"><span className="tabular text-sm">{formatINR(splitRupees(amounts[activeIndex], bucket.children.map((c) => c.percent))[i])}</span>{editing && <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${child.label} allocation`} onClick={() => change(bucket.id, { children: bucket.children.filter((c) => c.id !== child.id) })}><Trash2 className="size-4" /></Button>}</div>
        {editing && <Select aria-label={`${child.label || `Allocation ${i + 1}`} linked goal`} value={child.goalId ?? ""} onChange={(e) => { const goal = context.goals.find((g) => g.id === e.target.value); change(bucket.id, { children: bucket.children.map((c) => c.id === child.id ? { ...c, goalId: goal?.id ?? null, ...(goal ? { label: goal.name.slice(0, 60) } : {}) } : c) }); }}><option value="">No goal linked</option>{child.goalId && !context.goals.some((g) => g.id === child.goalId) && <option value={child.goalId}>Goal no longer available</option>}{context.goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>}
      </div>)}
      <p className={`tabular text-xs ${basisTotal(bucket.children) > 10000 ? "text-danger" : "text-muted-foreground"}`}>{basisTotal(bucket.children) > 10000 ? "These allocations exceed 100%. Reduce them before saving." : `${formatINR(amounts[activeIndex] - splitRupees(amounts[activeIndex], bucket.children.map((c) => c.percent)).reduce((a, b) => a + b, 0))} not assigned to a smaller allocation.`}</p>
      {editing && <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={bucket.children.length >= 20} onClick={() => change(bucket.id, { children: [...bucket.children, { id: crypto.randomUUID(), label: "", percent: 0, goalId: null }] })}><Plus className="size-4" /> Add allocation</Button><Button type="button" size="sm" variant="ghost" disabled={total !== 100 || amounts[activeIndex] <= 0} onClick={() => { const used = new Set(plan.buckets.filter((b) => b.id !== bucket.id).flatMap((b) => b.children.flatMap((c) => c.goalId ? [c.goalId] : []))); change(bucket.id, { children: suggestChildren(bucket, amounts[activeIndex], { ...context, goals: context.goals.filter((g) => !used.has(g.id)) }, draft.includedEmiIds) }); }}>Suggest allocations</Button></div>}
      <Button type="button" className="w-full" onClick={() => setActive(null)}>Done</Button>
    </div></Sheet>}
  </section>;
}
