"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  MoreHorizontal,
  Plus,
  Sparkles,
  Pencil,
} from "lucide-react";
import { rebalanceBudgetEdit } from "@/lib/budget-rebalance";
import { BudgetSips } from "@/components/budget-sips";
import { scaleSips } from "@/lib/budget-sips";
import { budgetSipAmount } from "@/lib/budget-sip-amount";
import { BudgetGuide } from "@/components/budget-guide";
import { Sheet } from "@/components/sheet";
import { Field } from "@/components/forms/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/money-input";
import { groupPersonalCosts } from "@/lib/personal-budget";
import { saveBudgetSheet, resetBudgetSheet } from "@/lib/budget-ratio-actions";
import { personalBudget } from "@/lib/budget-guide";
import { formatINR, formatINRCompact } from "@/lib/format";
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
  | { kind: "personal" }
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
  goals = [],
}: {
  initial: BudgetSheet | null;
  saved: boolean;
  salary: number;
  loans: SheetLoan[];
  knownCosts: KnownBudgetCost[];
  /** Monthly SIPs already going in. */
  sips: number;
  loadError: string | null;
  /** Your goals, one SIP line each. */
  goals?: { id: string; label: string; vehicles?: string[] }[];
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
  const edit = (next: Editing) => {
    setError("");
    setEditing(next);
  };

  /** Saves a changed budget straight away: tapping Save is the confirmation. */
  function persist(next: BudgetSheet, note = "Saved.") {
    let normalised = plan ? rebalanceBudgetEdit(plan, next) : applyBudgetRules(next);
    // When Save & invest changes, unlocked SIPs change with it.
    const before = plan ? budgetSipAmount(plan) : null;
    const after = budgetSipAmount(normalised);
    if (normalised.sips?.length && before !== null && after !== null && before !== after)
      normalised = { ...normalised, sips: scaleSips(normalised.sips, after) };
    setError("");
    start(async () => {
      try {
        const result = await saveBudgetSheet(normalised);
        if (!result.ok) return setError(result.error);
        setPlan(normalised);
        edit(null);
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
          <p
            role="alert"
            className="rounded-xl bg-danger-soft p-3 text-sm text-danger"
          >
            {loadError}
          </p>
        )}
        <div className="surface-card space-y-4 rounded-2xl border bg-card p-6">
          <Sparkles className="size-7 text-primary" aria-hidden />
          <h2 className="text-xl font-semibold">Create your monthly budget</h2>
          <p className="text-sm text-muted-foreground">
            Add your income, fixed costs and personal spending together. Then
            review your allocation and save.
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
        <p className="text-xs text-muted-foreground">
          Your SIPs live in your budget. Create one to plan them.
        </p>
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
    (b) => ({
      ...b,
      amount: rowsIn(b.id).reduce((s, r) => s + amountOf(r), 0),
    }),
  );
  const future = totals.find((b) => b.id === "future")?.amount ?? 0;
  const costs = totals
    .filter((b) => b.id !== "future")
    .reduce((s, b) => s + b.amount, 0);
  const over = noSalary ? 0 : -sheetTotals(plan).remaining;

  return (
    <section
      aria-label="Your budget"
      data-guide="budget-sheet"
      className="space-y-4"
    >
      {loadError && (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft p-3 text-sm text-danger"
        >
          {loadError}
        </p>
      )}
      <div className="surface-card overflow-hidden rounded-3xl border border-primary/15 bg-card">
        <div className="space-y-3 bg-gradient-to-br from-primary/5 to-transparent p-5">
          <button
            type="button"
            aria-label="Edit income"
            disabled={!!loadError}
            onClick={() => edit({ kind: "income" })}
            className="press flex w-full items-center justify-between gap-3 text-left"
          >
            <span>
              <span className="block text-xs text-muted-foreground">
                {noSalary ? "Monthly spending" : "Monthly take-home"}
              </span>
              <span className="tabular mt-1 block break-words text-3xl font-semibold tracking-tight">
                {formatINR(noSalary ? costs : plan.salary)}
              </span>
              {noSalary && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  No salary right now
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-full border bg-card px-3 py-2 text-xs text-primary">
              <Pencil className="size-3.5" aria-hidden /> Edit
            </span>
          </button>
          {!noSalary && (
            <div
              aria-hidden
              className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted"
            >
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
          <div
            className="divide-y divide-border/60"
            aria-label="Monthly allocation"
          >
            {totals.map((b) => {
              const content = (
                <>
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span
                      className={cn("size-2 shrink-0 rounded-full", b.color)}
                      aria-hidden
                    />
                    <span>
                      {b.id === "essentials"
                        ? "Fixed"
                        : b.id === "personal"
                          ? "Personal"
                          : "Save & invest"}
                    </span>
                  </span>
                  <span className="tabular whitespace-nowrap text-right text-sm font-semibold">
                    {formatINRCompact(b.amount)}
                  </span>
                  <span className="tabular whitespace-nowrap text-right text-xs text-muted-foreground">
                    {!noSalary && plan.salary > 0
                      ? `${Math.round((b.amount / plan.salary) * 100)}%`
                      : ""}
                  </span>
                  <span className="flex justify-end">
                    {b.id !== "essentials" && (
                      <Pencil className="size-3.5 text-primary" aria-hidden />
                    )}
                  </span>
                </>
              );
              const rowClass =
                cn("grid min-h-12 w-full items-center gap-2 py-3 text-left", noSalary ? "grid-cols-[minmax(0,1fr)_auto_0px_1rem]" : "grid-cols-[minmax(0,1fr)_5.5rem_2.25rem_1rem]");
              return b.id === "essentials" ? (
                <div key={b.id} className={rowClass}>
                  {content}
                </div>
              ) : (
                <button
                  key={b.id}
                  type="button"
                  aria-label={`Edit ${b.name}`}
                  disabled={!!loadError}
                  onClick={() =>
                    edit({ kind: b.id === "future" ? "future" : "personal" })
                  }
                  className={cn(
                    rowClass,
                    "press transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  )}
                >
                  {content}
                </button>
              );
            })}
          </div>
          {over > 0 && (
            <p
              role="alert"
              className="rounded-xl bg-danger-soft p-3 text-sm text-danger"
            >
              {formatINR(over)} over your income. Adjust a cost, personal
              spending or Save & invest.
            </p>
          )}
        </div>
      </div>
      <div className="surface-card rounded-2xl border bg-card p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Fixed spending</h3>
            <p className="text-xs text-muted-foreground">
              Rent, bills and EMIs
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!!loadError || plan.rows.length >= 97}
            onClick={() =>
              edit({
                kind: "row",
                isNew: true,
                row: {
                  id: crypto.randomUUID(),
                  name: "",
                  category: "fixed",
                  mode: "amount",
                  value: 0,
                  loanId: null,
                },
              })
            }
          >
            <Plus className="size-3.5" aria-hidden />
            Add cost
          </Button>
        </div>
        <ul className="divide-y">
          {rowsIn("essentials")
            .sort(
              (a, b) => amountOf(b) - amountOf(a) || a.id.localeCompare(b.id),
            )
            .map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  aria-label={`Edit ${r.name}`}
                  disabled={!!loadError}
                  onClick={() => edit({ kind: "row", row: r, isNew: false })}
                  className="press flex min-h-12 w-full items-center justify-between gap-3 py-3 text-left text-sm"
                >
                  <span className="min-w-0 break-words">
                    {r.name}
                    {r.loanId && !/emi/i.test(r.name) && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        EMI
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular font-medium">
                      {formatINR(amountOf(r))}
                    </span>
                    <ChevronRight
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                  </span>
                </button>
              </li>
            ))}
        </ul>
        {rowsIn("essentials").length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            No fixed costs added. Add rent, utilities or another recurring cost.
          </p>
        )}
      </div>
      <BudgetSips
        key={JSON.stringify(plan.sips ?? [])}
        rows={plan.sips ?? []}
        budgetMonthly={budgetSipAmount(plan)}
        salary={plan.noSalary ? 0 : plan.salary}
        goals={goals}
        pending={pending}
        error={editing ? "" : error}
        onSave={(sips, note) => persist({ ...plan, sips }, note)}
      />
      {rowsIn("personal").some(
        (r) => !isRuleRow(r) && r.id !== "setup-personal",
      ) && (
        <details className="surface-card rounded-2xl border bg-card px-4">
          <summary className="min-h-12 cursor-pointer py-3 text-sm font-medium">
            Personal spending details
          </summary>
          <ul className="divide-y">
            {rowsIn("personal")
              .filter((r) => !isRuleRow(r) && r.id !== "setup-personal")
              .map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={!!loadError}
                    aria-label={`Edit ${r.name}`}
                    onClick={() => edit({ kind: "row", row: r, isNew: false })}
                    className="flex min-h-11 w-full justify-between gap-3 py-3 text-left text-sm"
                  >
                    <span>{r.name}</span>
                    <span className="tabular shrink-0">
                      {formatINR(amountOf(r))}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </details>
      )}

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
          onClose={() => !pending && edit(null)}
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
      {editing?.kind === "personal" && (
        <AmountSheet
          title="Personal spending"
          label="Personal spending a month"
          hint="Keep this for your everyday and guilt-free spending. Save & invest adjusts to what remains."
          initial={totals.find((b) => b.id === "personal")?.amount ?? 0}
          pending={pending}
          error={error}
          onClose={() => !pending && edit(null)}
          onSave={(amount) => {
            const rows = plan.rows.filter(
              (r) => !isRuleRow(r) && r.id !== "setup-personal",
            );
            const split = personalBudget(plan.salary, rows, amount);
            const minimum = rows
              .filter((r) => r.category === "personal")
              .reduce((n, r) => n + amountOf(r), 0);
            if (noSalary) {
              if (amount < minimum)
                return setError(
                  `Your listed personal costs total ${formatINR(minimum)}. Reduce those costs first.`,
                );
              persist({
                ...plan,
                rows: [
                  ...rows,
                  ...(amount > minimum
                    ? [
                        {
                          id: "setup-personal",
                          name: "Personal spending",
                          category: "personal" as const,
                          mode: "amount" as const,
                          value: amount - minimum,
                          loanId: null,
                        },
                      ]
                    : []),
                ],
              });
            } else {
              if (!split.valid)
                return setError(split.error ?? "Review your personal amount.");
              persist({
                ...plan,
                rows,
                rules: {
                  savings: { mode: "amount", value: 0 },
                  investing: { mode: "amount", value: 0 },
                  future: { mode: "amount", value: split.future },
                },
              });
            }
          }}
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
          onClose={() => !pending && edit(null)}
          onSave={(amount) =>
            persist({
              ...plan,
              rows: plan.rows.filter(r => r.id !== "setup-personal" && !isRuleRow(r)),
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
          onClose={() => !pending && edit(null)}
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
        <Sheet
          title="Reset budget?"
          onClose={() => !pending && setReset(false)}
        >
          <div className="space-y-4">
            <p className="text-sm">
              This resets your budget and saved SIP plan so you can start fresh. Your
              goals, investments, loan records and provider SIPs stay as they are.
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
                    setMessage(
                      "Budget and SIP plan reset. Start fresh when you're ready.",
                    );
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
            category: row.loanId
              ? row.category
              : (category as "fixed" | "personal"),
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
              <MoneyInput
                id="income-input"
                value={amount}
                onChange={setAmount}
              />
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
