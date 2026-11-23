"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, MoreHorizontal, Plus, Sparkles } from "lucide-react";
import { BudgetGuide } from "@/components/budget-guide";
import { Sheet } from "@/components/sheet";
import { Field } from "@/components/forms/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/money-input";
import { groupPersonalCosts } from "@/lib/personal-budget";
import { saveBudgetSheet, resetBudgetSheet } from "@/lib/budget-ratio-actions";
import { formatINR } from "@/lib/format";
import {
  applyBudgetRules,
  emptyBudgetSheet,
  isRuleRow,
  rowAmount,
  sheetTotals,
  type BudgetSheet,
  type BudgetSheetRow,
  type SheetLoan,
} from "@/lib/budget-sheet";
import type { KnownBudgetCost } from "@/lib/budget-assist";
import { cn } from "@/lib/utils";

const BUCKETS = [
  { id: "essentials", name: "Fixed spending", color: "bg-slate-500" },
  { id: "personal", name: "Personal spending", color: "bg-pink-500" },
  { id: "future", name: "Save & invest", color: "bg-primary" },
] as const;
type BucketId = (typeof BUCKETS)[number]["id"];
const bucketFor = (category: string): BucketId =>
  category === "savings" || category === "investing"
    ? "future"
    : category === "personal"
      ? "personal"
      : "essentials";

type Editing =
  | { kind: "row"; row: BudgetSheetRow; isNew: boolean }
  | { kind: "future" }
  | { kind: "income" }
  | null;

/** The Budget tab: set up once, then tap any row to change it. */
export function BudgetExperience({
  initial,
  saved: hasSaved,
  salary,
  loans,
  knownCosts,
  sips,
  loadError,
}: {
  initial: BudgetSheet | null;
  saved: boolean;
  salary: number;
  loans: SheetLoan[];
  knownCosts: KnownBudgetCost[];
  /** Monthly SIPs already going in. */
  sips: number;
  loadError: string | null;
}) {
  const [plan, setPlan] = useState<BudgetSheet | null>(
    hasSaved && initial ? groupPersonalCosts(initial) : null,
  );
  const [guide, setGuide] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [options, setOptions] = useState(false);
  const [reset, setReset] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  /** Saves a changed budget straight away: tapping Save is the confirmation. */
  function persist(next: BudgetSheet, note = "Saved.") {
    const normalised = applyBudgetRules(next);
    setError("");
    start(async () => {
      try {
        const result = await saveBudgetSheet(normalised);
        if (!result.ok) return setError(result.error);
        setPlan(normalised);
        setEditing(null);
        setMessage(note);
        router.refresh();
      } catch {
        setError("Could not save. Try again.");
      }
    });
  }

  if (guide && !loadError)
    return (
      <BudgetGuide
        initial={plan ?? emptyBudgetSheet(salary)}
        costs={knownCosts}
        loans={loans}
        sips={sips}
        replacing={!!plan}
        onCancel={() => setGuide(false)}
        onSaved={(next) => {
          setPlan(next);
          setGuide(false);
          setMessage("Budget saved.");
          router.refresh();
        }}
      />
    );

  if (!plan)
    return (
      <section
        aria-label="Your budget"
        data-guide="budget-sheet"
        className="space-y-4"
      >
        {loadError && (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
            {loadError}
          </p>
        )}
        <div className="surface-card space-y-4 rounded-2xl border bg-card p-6">
          <Sparkles className="size-7 text-primary" aria-hidden />
          <h2 className="text-xl font-semibold">Create your monthly budget</h2>
          <p className="text-sm text-muted-foreground">
            Add your income, fixed costs and personal spending together. Then review your allocation and save.
          </p>
          <Button
            className="w-full"
            disabled={!!loadError}
            onClick={() => setGuide(true)}
          >
            Create budget
          </Button>
          <p className="text-xs text-muted-foreground">
            Nothing is saved until you confirm.
          </p>
        </div>
        {message && (
          <p role="status" className="text-sm text-primary">
            {message}
          </p>
        )}
      </section>
    );

  const noSalary = !!plan.noSalary;
  const amountOf = (r: BudgetSheetRow) => rowAmount(r, plan.salary);
  const rowsIn = (id: BucketId) =>
    plan.rows.filter((r) => bucketFor(r.category) === id);
  const totals = BUCKETS.filter((b) => !noSalary || b.id !== "future").map(
    (b) => ({ ...b, amount: rowsIn(b.id).reduce((s, r) => s + amountOf(r), 0) }),
  );
  const future = totals.find((b) => b.id === "future")?.amount ?? 0;
  const costs = totals
    .filter((b) => b.id !== "future")
    .reduce((s, b) => s + b.amount, 0);
  const over = noSalary ? 0 : -sheetTotals(plan).remaining;

  return (
    <section aria-label="Your budget" data-guide="budget-sheet" className="space-y-4">
      {loadError && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
          {loadError}
        </p>
      )}
      <div className="surface-card space-y-4 rounded-2xl border bg-card p-4">
        <button
          type="button"
          aria-label="Edit income"
          disabled={!!loadError}
          onClick={() => setEditing({ kind: "income" })}
          className="press flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="space-y-1">
            <span className="block text-xs text-muted-foreground">
              {noSalary ? "No salary right now" : "Monthly take-home"}
            </span>
            <span className="tabular block text-3xl font-semibold tracking-tight">
              {formatINR(noSalary ? costs : plan.salary)}
            </span>
            {noSalary && (
              <span className="block text-xs text-muted-foreground">
                needed each month until your next salary
              </span>
            )}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>

        {!noSalary && (
          <div aria-hidden className="flex h-2 overflow-hidden rounded-full bg-muted">
            {totals.map((b) => (
              <span
                key={b.id}
                className={b.color}
                style={{
                  width: `${(b.amount / Math.max(plan.salary, sheetTotals(plan).allocated, 1)) * 100}%`,
                }}
              />
            ))}
          </div>
        )}

        <div className="divide-y">
          {totals.map((b) => (
            <div key={b.id} className="py-3">
              <div className="flex items-center gap-3">
                <span className={cn("size-2.5 shrink-0 rounded-full", b.color)} aria-hidden />
                <h3 className="min-w-0 flex-1 text-sm font-semibold">{b.name}</h3>
                <span className="shrink-0 text-right">
                  <b className="tabular block">{formatINR(b.amount)}</b>
                  {!noSalary && plan.salary > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {Math.round((b.amount / plan.salary) * 100)}%
                    </span>
                  )}
                </span>
              </div>
              <details className="mt-1 pl-5"><summary className="min-h-9 cursor-pointer py-2 text-xs text-primary">View and edit</summary>
              <ul>
                {rowsIn(b.id)
                  .sort((x, y) => Number(isRuleRow(x)) - Number(isRuleRow(y)) || amountOf(y) - amountOf(x))
                  .map((r) => {
                    const derived = r.id === "rule-personal";
                    const label = derived
                      ? "Left to spend"
                      : r.id === "rule-savings"
                        ? sips > 0
                          ? "Save & invest (includes your SIPs)"
                          : "Save & invest"
                        : r.name;
                    const content = (
                      <>
                        <span className="min-w-0 flex-1 break-words">{label}</span>
                        <span className="tabular shrink-0">{formatINR(amountOf(r))}</span>
                      </>
                    );
                    return (
                      <li key={r.id}>
                        {derived ? (
                          <p className="flex min-h-10 items-center gap-3 text-sm text-muted-foreground">
                            {content}
                          </p>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Edit ${label}`}
                            disabled={!!loadError}
                            onClick={() =>
                              setEditing(
                                b.id === "future"
                                  ? { kind: "future" }
                                  : { kind: "row", row: r, isNew: false },
                              )
                            }
                            className="flex min-h-10 w-full items-center gap-3 text-left text-sm hover:text-primary"
                          >
                            {content}
                          </button>
                        )}
                      </li>
                    );
                  })}
                {b.id === "future" && rowsIn("future").length === 0 && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setEditing({ kind: "future" })}
                      className="flex min-h-10 items-center gap-1 text-sm text-primary"
                    >
                      <Plus className="size-3.5" aria-hidden /> Set an amount
                    </button>
                  </li>
                )}
                {b.id !== "future" && (
                  <li>
                    <button
                      type="button"
                      disabled={!!loadError || plan.rows.length >= 97}
                      onClick={() =>
                        setEditing({
                          kind: "row",
                          isNew: true,
                          row: {
                            id: crypto.randomUUID(),
                            name: "",
                            category: b.id === "personal" ? "personal" : "fixed",
                            mode: "amount",
                            value: 0,
                            loanId: null,
                          },
                        })
                      }
                      className="flex min-h-10 items-center gap-1 text-sm text-primary"
                    >
                      <Plus className="size-3.5" aria-hidden /> Add to {b.name}
                    </button>
                  </li>
                )}
              </ul></details>
            </div>
          ))}
        </div>

        {over > 0 && (
          <p role="alert" className="text-sm text-danger">
            This is {formatINR(over)} more than you earn. Lower Save & invest or
            a cost.
          </p>
        )}

      </div>

      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={!!loadError}
        className="text-muted-foreground"
        onClick={() => {
          setOptions(true);
          setError("");
        }}
      >
        <MoreHorizontal className="size-4" aria-hidden />
        Budget options
      </Button>

      {editing?.kind === "row" && (
        <RowSheet
          row={editing.row}
          isNew={editing.isNew}
          salary={plan.salary}
          pending={pending}
          error={error}
          onClose={() => !pending && setEditing(null)}
          onSave={(row) =>
            persist({
              ...plan,
              rows: editing.isNew
                ? [...plan.rows.filter((r) => !isRuleRow(r)), row]
                : plan.rows.map((r) => (r.id === row.id ? row : r)),
            })
          }
          onRemove={() =>
            persist(
              {
                ...plan,
                rows: plan.rows.filter((r) => r.id !== editing.row.id),
                excludedLoanIds: editing.row.loanId
                  ? [...new Set([...plan.excludedLoanIds, editing.row.loanId])]
                  : plan.excludedLoanIds,
              },
              `Removed ${editing.row.name}.`,
            )
          }
        />
      )}
      {editing?.kind === "future" && (
        <AmountSheet
          title="Save & invest"
          label="Save & invest a month"
          hint={
            sips > 0
              ? `Includes the ${formatINR(sips)} already going into your SIPs. Personal spending gets what's left.`
              : "Personal spending gets what's left."
          }
          initial={future}
          pending={pending}
          error={error}
          onClose={() => !pending && setEditing(null)}
          onSave={(amount) =>
            persist({
              ...plan,
              rules: {
                savings: { mode: "amount", value: 0 },
                investing: { mode: "amount", value: 0 },
                future: { mode: "amount", value: amount },
              },
            })
          }
        />
      )}
      {editing?.kind === "income" && (
        <IncomeSheet
          salary={plan.salary}
          noSalary={noSalary}
          pending={pending}
          error={error}
          onClose={() => !pending && setEditing(null)}
          onSave={(nextSalary, none) =>
            persist({
              ...plan,
              salary: none ? 0 : nextSalary,
              noSalary: none || undefined,
              rules: none
                ? {
                    savings: { mode: "amount", value: 0 },
                    investing: { mode: "amount", value: 0 },
                    future: { mode: "amount", value: 0 },
                  }
                : plan.rules,
            })
          }
        />
      )}
      {options && (
        <Sheet title="Budget options" onClose={() => setOptions(false)}>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setOptions(false);
                setGuide(true);
              }}
            >
              Run setup again
            </Button>
            <Button
              variant="ghost"
              className="w-full text-danger"
              onClick={() => {
                setOptions(false);
                setReset(true);
                setError("");
              }}
            >
              Reset budget
            </Button>
          </div>
        </Sheet>
      )}
      {reset && (
        <Sheet title="Reset budget?" onClose={() => !pending && setReset(false)}>
          <div className="space-y-4">
            <p className="text-sm">
              This removes only your saved budget. It can&apos;t be undone. Your
              loans, goals, investments and other records stay as they are.
            </p>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button
              variant="destructive"
              className="w-full"
              disabled={pending}
              onClick={() => {
                setError("");
                start(async () => {
                  try {
                    const result = await resetBudgetSheet("RESET_BUDGET");
                    if (!result.ok) return setError(result.error);
                    setPlan(null);
                    setReset(false);
                    setMessage("Budget reset. Start a new one when you're ready.");
                    router.refresh();
                  } catch {
                    setError("Could not reset. Try again.");
                  }
                });
              }}
            >
              Reset and start over
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={() => setReset(false)}
            >
              Keep my budget
            </Button>
          </div>
        </Sheet>
      )}
    </section>
  );
}

function RowSheet({
  row,
  isNew,
  salary,
  pending,
  error,
  onClose,
  onSave,
  onRemove,
}: {
  row: BudgetSheetRow;
  isNew: boolean;
  salary: number;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSave: (row: BudgetSheetRow) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(row.name);
  const [amount, setAmount] = useState<number | null>(
    isNew ? null : rowAmount(row, salary),
  );
  const [category, setCategory] = useState(
    row.category === "personal" ? "personal" : "fixed",
  );
  return (
    <Sheet title={isNew ? "Add a cost" : row.name} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || amount === null) return;
          onSave({
            ...row,
            name: name.trim(),
            mode: "amount",
            value: amount,
            category: row.loanId ? row.category : (category as "fixed" | "personal"),
          });
        }}
      >
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          {!row.loanId && (
            <Field label="Name" htmlFor="row-name">
              <Input
                id="row-name"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Groceries"
              />
            </Field>
          )}
          <Field label="Monthly amount" htmlFor="row-amount">
            <MoneyInput id="row-amount" value={amount} onChange={setAmount} />
          </Field>
          {!row.loanId && (
            <Field label="Counts as" htmlFor="row-bucket">
              <Select
                id="row-bucket"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="fixed">Fixed spending</option>
                <option value="personal">Personal spending</option>
              </Select>
            </Field>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={!name.trim() || amount === null}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
          {!isNew && (
            <Button
              type="button"
              variant="ghost"
              className="w-full text-danger"
              onClick={onRemove}
            >
              Remove from budget
            </Button>
          )}
        </fieldset>
      </form>
    </Sheet>
  );
}

function AmountSheet({
  title,
  label,
  hint,
  initial,
  pending,
  error,
  onClose,
  onSave,
}: {
  title: string;
  label: string;
  hint: string;
  initial: number;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSave: (amount: number) => void;
}) {
  const [amount, setAmount] = useState<number | null>(initial);
  return (
    <Sheet title={title} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(amount ?? 0);
        }}
      >
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          <Field label={label} htmlFor="amount-input" hint={hint}>
            <MoneyInput id="amount-input" value={amount} onChange={setAmount} />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full">
            {pending ? "Saving…" : "Save"}
          </Button>
        </fieldset>
      </form>
    </Sheet>
  );
}

function IncomeSheet({
  salary,
  noSalary,
  pending,
  error,
  onClose,
  onSave,
}: {
  salary: number;
  noSalary: boolean;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSave: (salary: number, noSalary: boolean) => void;
}) {
  const [amount, setAmount] = useState<number | null>(salary || null);
  const [none, setNone] = useState(noSalary);
  return (
    <Sheet title="Income" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(amount ?? 0, none);
        }}
      >
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={none}
              onChange={(e) => setNone(e.target.checked)}
            />
            No salary right now
          </label>
          {!none && (
            <Field label="Monthly take-home income" htmlFor="income-input">
              <MoneyInput id="income-input" value={amount} onChange={setAmount} />
            </Field>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={!none && !amount}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </fieldset>
      </form>
    </Sheet>
  );
}
