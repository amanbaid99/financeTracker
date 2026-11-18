"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/money-input";
import { Field } from "@/components/forms/field";
import { formatINR } from "@/lib/format";
import { saveRatioPlan } from "@/lib/budget-ratio-actions";
import {
  BUCKET_KINDS, basisTotal, defaultRatioPlan, ratioPlanSchema, ratioWarnings,
  splitRupees, suggestChildren, suggestRatioPlan,
  type RatioPlan, type RatioBucket, type RatioContext,
} from "@/lib/budget-ratios";

const COLORS = ["bg-primary", "bg-success", "bg-warning", "bg-danger", "bg-foreground/50"];
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
  const [expanded, setExpanded] = useState<string[]>([]);
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
  const warnings = total === 100 ? ratioWarnings(plan, context) : [];
  const change = (id: string, patch: Partial<RatioBucket>) => {
    setDraft((p) => ({ ...p, buckets: p.buckets.map((b) => b.id === id ? { ...b, ...patch } : b) }));
    setMessage(""); setError(""); setBeforeSuggestion(null);
  };
  const suggest = () => {
    const result = suggestRatioPlan(draft.salary, context);
    setBeforeSuggestion(draft); setDraft(result.plan); setReasons(result.reasons); setError(""); setMessage("Suggested split ready. Review it, then save when it looks right.");
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
  return <section aria-labelledby="ratio-budget-heading" data-guide="ratio-budget" className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div><h2 id="ratio-budget-heading" className="text-lg font-semibold">Plan my budget</h2><p className="text-sm text-muted-foreground">One monthly salary. A place for every rupee.</p></div>
      {!editing && <Button variant="outline" size="sm" onClick={() => { setDraft(saved!); setEditing(true); setMessage(""); }}>Edit budget</Button>}
    </div>
    {loadError && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{loadError}</p>}
    <fieldset disabled={pending || !!loadError} className="min-w-0 space-y-4 disabled:opacity-60">
      <div className="surface-card space-y-4 rounded-2xl border bg-card p-4">
        {editing ? <Field label="Monthly take-home salary" htmlFor="ratio-salary" hint="Use the amount that reaches your bank account.">
          <MoneyInput id="ratio-salary" value={draft.salary || null} onChange={(v) => { setDraft((p) => ({ ...p, salary: v ?? 0 })); setMessage(""); }} />
        </Field> : <div><p className="text-xs text-muted-foreground">Monthly take-home salary</p><p className="tabular text-3xl font-semibold tracking-tight">{formatINR(plan.salary)}</p></div>}
        {editing && <Button type="button" variant="outline" className="w-full" disabled={draft.salary <= 0 || draft.salary > 1e9} onClick={suggest}><Sparkles className="size-4" /> Suggest a split</Button>}
        <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>{total <= 100 && plan.buckets.map((b, i) => <span key={b.id} className={COLORS[i % COLORS.length]} style={{ width: `${b.percent}%` }} />)}</div>
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="tabular font-medium">{total}% allocated</span><span className="tabular text-muted-foreground">{total <= 100 ? `${formatINR(plan.salary - amounts.reduce((a, b) => a + b, 0))} unassigned` : `${(total - 100).toFixed(2).replace(/\.00$/, "")}% over budget`}</span></div>
        {editing && <p className="text-xs text-muted-foreground">Main buckets share your salary and must total 100%. Smaller buckets share their parent bucket.</p>}
      </div>
      {beforeSuggestion && editing && <Button type="button" size="sm" variant="ghost" onClick={() => { setDraft(beforeSuggestion); setBeforeSuggestion(null); setReasons([]); setMessage("Previous split restored."); }}>Undo suggested split</Button>}
      {reasons.length > 0 && editing && <details className="rounded-xl border bg-card p-3 text-sm"><summary className="cursor-pointer font-medium">Why this split?</summary><ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">{reasons.map((r) => <li key={r}>{r}</li>)}</ul><p className="mt-2 text-xs text-muted-foreground">A starting point for your review, not investment advice.</p></details>}
      <div className="space-y-3">{plan.buckets.map((b, i) => {
        const amount = amounts[i];
        const childAmounts = splitRupees(amount, b.children.map((c) => c.percent));
        const childTotal = basisTotal(b.children) / 100;
        const isOpen = expanded.includes(b.id);
        return <article key={b.id} aria-label={`${b.label || "Unnamed"} bucket`} className="overflow-hidden rounded-2xl border bg-card">
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2"><span className={`size-2 shrink-0 rounded-full ${COLORS[i % COLORS.length]}`} aria-hidden />
              {editing ? <Input aria-label={`Bucket ${i + 1} name`} value={b.label} maxLength={60} onChange={(e) => change(b.id, { label: e.target.value })} className="min-w-0 flex-1 font-medium" /> : <h3 className="min-w-0 flex-1 break-words font-medium">{b.label}</h3>}
              {editing ? <PercentInput label={`${b.label || `Bucket ${i + 1}`} salary percentage`} value={b.percent} onChange={(percent) => change(b.id, { percent })} /> : <span className="tabular text-sm text-muted-foreground">{b.percent}%</span>}
            </div>
            <div className="flex items-center justify-between gap-2"><p className="tabular text-xl font-semibold">{total > 100 ? "Check ratios" : formatINR(amount)}</p>
              <button type="button" aria-expanded={isOpen} aria-controls={`ratio-details-${b.id}`} onClick={() => setExpanded((x) => isOpen ? x.filter((id) => id !== b.id) : [...x, b.id])} className="inline-flex min-h-11 items-center gap-1 text-sm text-primary">{b.children.length ? `${b.children.length} smaller bucket${b.children.length === 1 ? "" : "s"}` : editing ? "Add details" : "Details"}<ChevronDown className={`size-4 ${isOpen ? "rotate-180" : ""}`} /></button>
            </div>
          </div>
          {isOpen && <div id={`ratio-details-${b.id}`} className="space-y-4 border-t bg-muted/20 p-4">
            {editing && <div className="flex flex-wrap items-end gap-2"><Field label="Bucket purpose" htmlFor={`purpose-${b.id}`} className="min-w-0 flex-1"><Select id={`purpose-${b.id}`} value={b.kind} onChange={(e) => change(b.id, { kind: e.target.value as RatioBucket["kind"] })}>{Object.entries(BUCKET_KINDS).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</Select></Field><Button type="button" size="sm" variant="ghost" aria-label={`Remove ${b.label} bucket`} onClick={() => setDraft((p) => ({ ...p, buckets: p.buckets.filter((x) => x.id !== b.id) }))}><Trash2 className="size-4" /> Remove</Button></div>}
            <p className="text-xs text-muted-foreground">Percentages below are of {b.label || "this bucket"}, not your salary.</p>
            {b.children.map((c, j) => <div key={c.id} className="space-y-2 border-b pb-3 last:border-0">
              <div className="flex items-center gap-2">{editing ? <Input aria-label={`${b.label} smaller bucket ${j + 1} name`} value={c.label} maxLength={60} onChange={(e) => change(b.id, { children: b.children.map((x) => x.id === c.id ? { ...x, label: e.target.value } : x) })} className="min-w-0 flex-1" /> : <span className="min-w-0 flex-1 break-words text-sm">{c.label}</span>}
                {editing ? <PercentInput label={`${c.label || `Smaller bucket ${j + 1}`} share of ${b.label}`} value={c.percent} onChange={(percent) => change(b.id, { children: b.children.map((x) => x.id === c.id ? { ...x, percent } : x) })} /> : <span className="tabular text-sm">{c.percent}%</span>}
              </div>
              <div className="flex items-center justify-between gap-2"><span className="tabular text-sm font-medium">{childTotal > 100 || total > 100 ? "Check ratios" : formatINR(childAmounts[j])}</span>{editing && <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${c.label} from ${b.label}`} onClick={() => change(b.id, { children: b.children.filter((x) => x.id !== c.id) })}><Trash2 className="size-4" /></Button>}</div>
              {editing && <Select aria-label={`${c.label || `Smaller bucket ${j + 1}`} linked goal`} value={c.goalId ?? ""} onChange={(e) => {
                const goal = context.goals.find((g) => g.id === e.target.value);
                change(b.id, { children: b.children.map((x) => x.id === c.id ? { ...x, goalId: goal?.id ?? null, ...(goal ? { label: goal.name.slice(0, 60) } : {}) } : x) });
              }}><option value="">No goal linked</option>{c.goalId && !context.goals.some((g) => g.id === c.goalId) && <option value={c.goalId}>Goal no longer available</option>}{context.goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>}
            </div>)}
            <p className={`tabular text-xs ${childTotal > 100 ? "text-danger" : "text-muted-foreground"}`}>{childTotal > 100 ? `${childTotal}% allocated. Reduce this to 100% or less.` : `${formatINR(amount - childAmounts.reduce((a, c) => a + c, 0))} still available within ${b.label || "this bucket"}.`}</p>
            {editing && <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={b.children.length >= 20} onClick={() => change(b.id, { children: [...b.children, { id: crypto.randomUUID(), label: "", percent: 0, goalId: null }] })}><Plus className="size-4" /> Add smaller bucket</Button><Button type="button" size="sm" variant="ghost" disabled={total !== 100 || amount <= 0} onClick={() => {
              const elsewhere = new Set(plan.buckets.filter((x) => x.id !== b.id).flatMap((x) => x.children.flatMap((c) => c.goalId ? [c.goalId] : [])));
              const children = suggestChildren(b, amount, { ...context, goals: context.goals.filter((g) => !elsewhere.has(g.id)) });
              change(b.id, { children }); setMessage(children.length ? `Suggested details for ${b.label}. Review before saving.` : "No matching commitments or unfinished goals. Add your own smaller buckets.");
            }}>Suggest details</Button></div>}
          </div>}
        </article>;
      })}</div>
      {editing && <Button type="button" variant="outline" className="w-full" disabled={draft.buckets.length >= 12} onClick={() => setDraft((p) => ({ ...p, buckets: [...p.buckets, { id: crypto.randomUUID(), label: "", kind: "custom", percent: 0, children: [] }] }))}><Plus className="size-4" /> Add main bucket</Button>}
      {warnings.length > 0 && <div className="space-y-1 rounded-xl bg-warning-soft p-3 text-sm" role="status">{warnings.map((w) => <p key={w}>{w}</p>)}</div>}
      <p className="text-xs text-muted-foreground">This is a monthly plan, not a spending tracker. Saving it does not change recorded income, costs, SIPs or loan payments.</p>
      {editing && <div className="flex flex-wrap gap-2"><Button type="button" className="flex-1" onClick={save} disabled={!valid.success}>{pending ? "Saving…" : "Save budget"}</Button>{saved && <Button type="button" variant="outline" onClick={() => { setDraft(saved); setEditing(false); setBeforeSuggestion(null); setError(""); setReasons([]); setMessage(""); }}>Cancel</Button>}</div>}
    </fieldset>
    {editing && !valid.success && <p className="text-sm text-muted-foreground">{valid.error.issues[0]?.message}</p>}
    {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    {message && <p role="status" className="text-sm text-primary">{message}</p>}
  </section>;
}
