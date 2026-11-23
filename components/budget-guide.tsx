"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/money-input";
import { Field } from "@/components/forms/field";
import { saveBudgetSheet } from "@/lib/budget-ratio-actions";
import {
  QUICK_ADDS,
  composeGuidedBudget,
  costTotal,
  guideCosts,
  recommendBudget,
} from "@/lib/budget-guide";
import {
  budgetSheetSchema,
  rowAmount,
  sheetTotals,
  type BudgetSheet,
  type BudgetSheetRow,
  type SheetLoan,
} from "@/lib/budget-sheet";
import type { KnownBudgetCost } from "@/lib/budget-assist";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = { row: BudgetSheetRow; included: boolean; source: string };

/**
 * Three steps: income (or none right now), your monthly costs in one list
 * prefilled from your records, then a suggested split. Saves only on Save.
 */
export function BudgetGuide({
  initial,
  costs,
  loans,
  sips,
  replacing,
  onCancel,
  onSaved,
}: {
  initial: BudgetSheet;
  costs: KnownBudgetCost[];
  loans: SheetLoan[];
  /** Monthly SIPs already going in. */
  sips: number;
  replacing: boolean;
  onCancel: () => void;
  onSaved: (plan: BudgetSheet) => void;
}) {
  const [salary, setSalary] = useState(initial.salary);
  const [noSalary, setNoSalary] = useState(!!initial.noSalary);
  const [items, setItems] = useState<Item[]>(() =>
    guideCosts(initial, costs, loans),
  );
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState<number | null>(null);
  const [future, setFuture] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step]);

  const rows = items.filter((i) => i.included).map((i) => i.row);
  const rec = recommendBudget(salary, rows, sips);
  const futureAmount = noSalary ? 0 : (future ?? rec.future);
  const plan = composeGuidedBudget(salary, rows, loans, futureAmount, noSalary);
  const personal = plan.rows
    .filter((r) => r.category === "personal")
    .reduce((s, r) => s + rowAmount(r, plan.salary), 0);
  const over = noSalary ? 0 : -sheetTotals(plan).remaining;
  const valid = budgetSheetSchema.safeParse(plan).success && over <= 0;
  const monthlyCosts = costTotal(rows, salary);

  const setItem = (id: string, patch: Partial<Item>) =>
    setItems((list) =>
      list.map((i) => (i.row.id === id ? { ...i, ...patch } : i)),
    );
  const add = (name: string, category: "fixed" | "personal", value = 0) => {
    setItems((list) => [
      ...list,
      {
        row: {
          id: crypto.randomUUID(),
          name,
          category,
          mode: "amount",
          value,
          loanId: null,
        },
        included: true,
        source: "Added now",
      },
    ]);
    setFuture(null);
  };
  const listed = new Set(items.map((i) => i.row.name.toLowerCase()));

  function save() {
    if (!valid) return;
    setError("");
    start(async () => {
      try {
        const result = await saveBudgetSheet(plan);
        if (!result.ok) return setError(result.error);
        onSaved(plan);
      } catch {
        setError("Could not save. Your answers are still here. Try again.");
      }
    });
  }

  const title =
    step === 0
      ? "What lands in your account each month?"
      : step === 1
        ? "Your monthly costs"
        : noSalary
          ? "Your monthly costs, in one number"
          : "Here's a starting plan";

  return (
    <section
      aria-label="Budget setup"
      data-guide="budget-sheet"
      className="space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Step {step + 1} of 3</p>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={onCancel}
        >
          Close setup <X className="size-4" aria-hidden />
        </Button>
      </div>
      <progress
        aria-label="Budget setup progress"
        max={3}
        value={step + 1}
        className="h-1.5 w-full accent-primary"
      />
      <div className="surface-card space-y-5 rounded-2xl border bg-card p-5">
        <h2
          ref={heading}
          tabIndex={-1}
          className="text-xl font-semibold"
          aria-live="polite"
        >
          {title}
        </h2>
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          {step === 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                Take-home pay after tax, in a normal month.
              </p>
              <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={noSalary}
                  onChange={(e) => setNoSalary(e.target.checked)}
                />
                No salary right now
              </label>
              {!noSalary && (
                <Field label="Monthly take-home income" htmlFor="guide-income">
                  <MoneyInput
                    id="guide-income"
                    value={salary || null}
                    onChange={(v) => {
                      setSalary(v ?? 0);
                      setFuture(null);
                    }}
                  />
                </Field>
              )}
              {noSalary && (
                <p className="text-sm text-muted-foreground">
                  Your budget will be just your monthly costs. Covered till
                  salary uses it to show how long your money lasts.
                </p>
              )}
              <Button
                className="w-full"
                disabled={!noSalary && (salary <= 0 || salary > 1e9)}
                onClick={() => setStep(1)}
              >
                Continue
              </Button>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm text-muted-foreground">
                Filled in from your records. Untick anything you don&apos;t pay,
                and fix any amount.
              </p>
              {items.length === 0 && (
                <p className="text-sm">
                  No costs recorded yet. Add them below.
                </p>
              )}
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={item.row.id} className="space-y-2 py-3">
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-primary"
                        checked={item.included}
                        onChange={(e) => {
                          setItem(item.row.id, { included: e.target.checked });
                          setFuture(null);
                        }}
                      />
                      <span className="min-w-0 flex-1 break-words">
                        {item.row.name}
                        <span className="block text-xs text-muted-foreground">
                          {item.row.category === "personal"
                            ? "Personal spending"
                            : "Essential"}{" "}
                          · {item.source}
                        </span>
                      </span>
                    </label>
                    {item.included && (
                      <MoneyInput
                        aria-label={`${item.row.name} monthly amount`}
                        value={item.row.value || null}
                        onChange={(v) => {
                          setItem(item.row.id, {
                            row: { ...item.row, value: v ?? 0 },
                          });
                          setFuture(null);
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Add a common cost
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ADDS.filter(
                    (q) => !listed.has(q.name.toLowerCase()),
                  ).map((q) => (
                    <button
                      key={q.name}
                      type="button"
                      onClick={() => add(q.name, q.category)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm hover:border-primary"
                    >
                      <Plus className="size-3.5" aria-hidden />
                      {q.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_8rem] items-end gap-2">
                <Field label="Something else" htmlFor="guide-new-name">
                  <Input
                    id="guide-new-name"
                    maxLength={80}
                    value={newName}
                    placeholder="e.g. Family support"
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </Field>
                <Field label="A month" htmlFor="guide-new-amount">
                  <MoneyInput
                    id="guide-new-amount"
                    value={newAmount}
                    onChange={setNewAmount}
                  />
                </Field>
              </div>
              <Button
                variant="outline"
                className="w-full"
                disabled={!newName.trim() || !newAmount || items.length >= 95}
                onClick={() => {
                  add(newName.trim(), "fixed", newAmount ?? 0);
                  setNewName("");
                  setNewAmount(null);
                }}
              >
                <Plus className="size-4" aria-hidden /> Add it
              </Button>
              <p className="tabular text-sm">
                Total: <b>{formatINR(monthlyCosts)}</b> a month
              </p>
              <Button
                className="w-full"
                disabled={rows.some((r) => r.value > 1e9)}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </>
          )}

          {step === 2 && noSalary && (
            <>
              <div className="rounded-xl bg-primary-soft p-4">
                <p className="text-sm">You need about</p>
                <p className="tabular text-3xl font-semibold">
                  {formatINR(monthlyCosts)}
                  <span className="text-base font-normal"> a month</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  until your next salary. Covered till salary uses this.
                </p>
              </div>
              <CostList rows={rows} salary={salary} onChange={() => setStep(1)} />
            </>
          )}

          {step === 2 && !noSalary && (
            <>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt>Take-home income</dt>
                  <dd className="tabular font-semibold">{formatINR(salary)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Essentials</dt>
                  <dd className="tabular font-semibold">
                    {formatINR(rec.essentials)}
                  </dd>
                </div>
              </dl>
              <Field
                label="Save & invest a month"
                htmlFor="guide-future"
                hint={
                  sips > 0
                    ? `Includes the ${formatINR(sips)} already going into your SIPs.`
                    : undefined
                }
              >
                <MoneyInput
                  id="guide-future"
                  value={futureAmount}
                  onChange={(v) => setFuture(v ?? 0)}
                />
              </Field>
              <div className="rounded-xl bg-primary-soft p-3">
                <p className="text-sm">Personal spending</p>
                <p className="tabular text-2xl font-semibold">
                  {formatINR(personal)}
                </p>
                <p className="text-xs text-muted-foreground">
                  What&apos;s left after essentials and Save & invest, including
                  your day-to-day costs.
                </p>
              </div>
              {over > 0 && (
                <p role="alert" className="text-sm text-danger">
                  That&apos;s {formatINR(over)} more than you earn. Lower Save
                  & invest or go back to your costs.
                </p>
              )}
              {future !== null && future !== rec.future && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFuture(null)}
                >
                  Use the suggestion ({formatINR(rec.future)})
                </Button>
              )}
              <details className="text-sm">
                <summary className="min-h-10 cursor-pointer text-primary">
                  How this was worked out
                </summary>
                <ul className="list-disc space-y-2 pl-5 text-xs text-muted-foreground">
                  {rec.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </details>
              <CostList rows={rows} salary={salary} onChange={() => setStep(1)} />
            </>
          )}

          {step === 2 && (
            <>
              {replacing && (
                <p className="text-xs text-muted-foreground">
                  Saving replaces your current budget. Goals, investments and
                  SIPs stay as they are.
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <Button className="w-full" disabled={!valid} onClick={save}>
                {pending ? "Saving…" : "Save this budget"}
              </Button>
            </>
          )}
        </fieldset>
      </div>
      {step > 0 && (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => setStep(step - 1)}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
      )}
    </section>
  );
}

function CostList({
  rows,
  salary,
  onChange,
}: {
  rows: BudgetSheetRow[];
  salary: number;
  onChange: () => void;
}) {
  return (
    <details className="text-sm">
      <summary className="min-h-10 cursor-pointer text-primary">
        Your costs ({rows.length})
      </summary>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between gap-3 py-2">
            <span className={cn("min-w-0 break-words")}>{r.name}</span>
            <span className="tabular shrink-0">
              {formatINR(rowAmount(r, salary))}
            </span>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" onClick={onChange}>
        Change costs
      </Button>
    </details>
  );
}
