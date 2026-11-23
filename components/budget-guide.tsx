"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { MoneyInput } from "./money-input";
import { Field } from "./forms/field";
import { saveBudgetSheet } from "@/lib/budget-ratio-actions";
import {
  budgetSetupCosts,
  composeGuidedBudget,
  expenseTotal,
  personalBudget,
} from "@/lib/budget-guide";
import { personalMinimum } from "@/lib/personal-budget";
import {
  budgetSheetSchema,
  rowAmount,
  type BudgetSheet,
  type BudgetSheetRow,
  type SheetLoan,
} from "@/lib/budget-sheet";
import type { KnownBudgetCost } from "@/lib/budget-assist";
import { formatINR } from "@/lib/format";

/** Your numbers together, then a review. Nothing saves between screens. */
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
  sips: number;
  replacing: boolean;
  onCancel: () => void;
  onSaved: (plan: BudgetSheet) => void;
}) {
  const [salary, setSalary] = useState(initial.salary);
  const [noSalary, setNoSalary] = useState(!!initial.noSalary);
  const [items, setItems] = useState(() =>
    budgetSetupCosts(initial, costs, loans),
  );
  const [personal, setPersonal] = useState<number | null>(() =>
    initial.rows.length || initial.rules
      ? initial.rows
          .filter((r) => r.category === "personal")
          .reduce((sum, r) => sum + rowAmount(r, initial.salary), 0)
      : null,
  );
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step]);
  const rows = items
    .filter((i) => i.included && i.row.value > 0)
    .map((i) => i.row);
  const minimum = personalMinimum(rows, salary),
    personalAmount = personal ?? minimum;
  const split = personalBudget(salary, rows, personalAmount);
  const fixed = expenseTotal(rows, salary),
    future = noSalary ? 0 : split.future;
  const planRows: BudgetSheetRow[] =
    noSalary && personalAmount > minimum
      ? [
          ...rows,
          {
            id: "setup-personal",
            name: "Personal spending",
            category: "personal",
            mode: "amount",
            value: personalAmount - minimum,
            loanId: null,
          },
        ]
      : rows;
  const plan = composeGuidedBudget(salary, planRows, loans, future, noSalary);
  const personalValid =
    Number.isSafeInteger(personalAmount) &&
    personalAmount >= minimum &&
    personalAmount <= 1e9;
  const valid =
    budgetSheetSchema.safeParse(plan).success &&
    personalValid &&
    (noSalary ||
      (salary > 0 && salary <= 1e9 && personal !== null && split.valid));
  const shares = [
    { name: "Fixed spending", amount: fixed, color: "bg-slate-500" },
    { name: "Personal spending", amount: personalAmount, color: "bg-pink-500" },
    { name: "Save & invest", amount: future, color: "bg-primary" },
  ];
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
  return (
    <section
      aria-label="Budget setup"
      data-guide="budget-sheet"
      className="space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Step {step + 1} of 2</p>
        <Button variant="ghost" size="sm" disabled={pending} onClick={onCancel}>
          Close setup <X className="size-4" aria-hidden />
        </Button>
      </div>
      <progress
        aria-label="Budget setup progress"
        max={2}
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
          {step === 0 ? "Your monthly numbers" : "Your budget allocation"}
        </h2>
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          {step === 0 ? (
            <>
              <label className="flex min-h-10 items-center gap-3 text-sm">
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
                    onChange={(v) => setSalary(v ?? 0)}
                  />
                </Field>
              )}
              <div className="space-y-2 border-t pt-3">
                <h3 className="text-sm font-semibold">Fixed spending</h3>
                <p className="text-xs text-muted-foreground">
                  Known expenses and EMIs are filled in. Leave anything you
                  don&apos;t pay blank.
                </p>
                <ul className="divide-y">
                  {items.map((item) => (
                    <li key={item.row.id} className="space-y-2 py-3">
                      <label className="flex items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 accent-primary"
                          checked={item.included}
                          onChange={(e) =>
                            setItems((list) =>
                              list.map((i) =>
                                i.row.id === item.row.id
                                  ? { ...i, included: e.target.checked }
                                  : i,
                              ),
                            )
                          }
                        />
                        <span className="min-w-0 break-words">
                          {item.row.name}
                          {item.row.category === "personal" && (
                            <span className="block text-xs text-muted-foreground">
                              Included in Personal spending below
                            </span>
                          )}
                        </span>
                      </label>
                      {item.included && (
                        <MoneyInput
                          aria-label={`${item.row.name} monthly amount`}
                          value={item.row.value || null}
                          onChange={(v) =>
                            setItems((list) =>
                              list.map((i) =>
                                i.row.id === item.row.id
                                  ? { ...i, row: { ...i.row, value: v ?? 0 } }
                                  : i,
                              ),
                            )
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
                <details>
                  <summary className="min-h-10 cursor-pointer text-sm text-primary">
                    Add another expense
                  </summary>
                  <div className="space-y-3 pt-2">
                    <Field label="Expense name" htmlFor="guide-new-name">
                      <Input
                        id="guide-new-name"
                        maxLength={80}
                        value={newName}
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
                    <Button
                      variant="outline"
                      disabled={
                        !newName.trim() || !newAmount || items.length >= 95
                      }
                      onClick={() => {
                        setItems((list) => [
                          ...list,
                          {
                            row: {
                              id: crypto.randomUUID(),
                              name: newName.trim(),
                              category: "fixed",
                              mode: "amount",
                              value: newAmount ?? 0,
                              loanId: null,
                            },
                            included: true,
                            source: "Added now",
                          },
                        ]);
                        setNewName("");
                        setNewAmount(null);
                      }}
                    >
                      <Plus className="size-4" aria-hidden />
                      Add it
                    </Button>
                  </div>
                </details>
              </div>
              <Field
                label="Personal spending a month"
                htmlFor="guide-personal"
                hint="How much you want to keep for yourself. Enter 0 if none. The rest after fixed spending goes to Save & invest."
              >
                <MoneyInput
                  id="guide-personal"
                  value={personal}
                  onChange={setPersonal}
                />
              </Field>
              {(personal !== null || minimum > 0) &&
                (!personalValid || (!noSalary && !split.valid)) && (
                  <p role="alert" className="text-sm text-danger">
                    {personalAmount < minimum
                      ? `Your listed personal costs already total ${formatINR(minimum)}. Change those costs or keep at least this amount.`
                      : (split.error ?? "Enter a whole-rupee personal amount.")}
                  </p>
                )}
              <Button
                className="w-full"
                disabled={!valid}
                onClick={() => setStep(1)}
              >
                Review allocation
              </Button>
            </>
          ) : (
            <>
              {!noSalary && (
                <p className="flex justify-between gap-3 text-sm">
                  <span>Take-home income</span>
                  <b className="tabular">{formatINR(salary)}</b>
                </p>
              )}
              <div
                aria-hidden
                className="flex h-2 overflow-hidden rounded-full bg-muted"
              >
                {shares.map((s) => (
                  <span
                    key={s.name}
                    className={s.color}
                    style={{
                      width: `${(s.amount / Math.max(noSalary ? 0 : salary, fixed + personalAmount + future, 1)) * 100}%`,
                    }}
                  />
                ))}
              </div>
              <dl className="divide-y">
                {shares.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <dt className="flex items-center gap-2">
                      <span
                        className={`size-2 shrink-0 rounded-full ${s.color}`}
                        aria-hidden
                      />
                      {s.name}
                    </dt>
                    <dd className="tabular font-semibold">
                      {formatINR(s.amount)}
                    </dd>
                  </div>
                ))}
              </dl>
              {noSalary ? (
                <p className="text-sm text-muted-foreground">
                  Your monthly costs total {formatINR(fixed + personalAmount)}.
                  There are no new saving contributions without income.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Save & invest is what remains after fixed spending and your
                  personal amount.
                </p>
              )}
              {sips > 0 && !noSalary && (
                <p className="text-xs text-muted-foreground">
                  Includes your recorded {formatINR(sips)}/mo SIPs.
                  {future < sips
                    ? " Review them with your provider if this budget cannot cover them. Nothing is changed automatically."
                    : ""}
                </p>
              )}
              {replacing && (
                <p className="text-xs text-muted-foreground">
                  Saving replaces your budget. Goals, investments and SIPs stay
                  unchanged.
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
        <Button variant="ghost" disabled={pending} onClick={() => setStep(0)}>
          <ArrowLeft className="size-4" aria-hidden />
          Edit details
        </Button>
      )}
    </section>
  );
}
