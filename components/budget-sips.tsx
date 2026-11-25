"use client";
import { useState } from "react";
import { ChevronRight, Lock, Plus, Sparkles } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { Field } from "@/components/forms/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/money-input";
import { formatINR } from "@/lib/format";
import { sipStatus, type SipRow } from "@/lib/budget-sips";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string };

/**
 * Your SIPs, set by hand: each row is a fund or account, a monthly amount
 * and the goal it's for. Tap a row to change it. Saving happens on Save.
 */
export function BudgetSips({
  rows,
  budgetMonthly,
  holdings,
  goals,
  suggestion,
  pending,
  error,
  onSave,
}: {
  rows: SipRow[];
  /** Save & invest a month from the budget, or null with no salary. */
  budgetMonthly: number | null;
  holdings: Option[];
  goals: Option[];
  /** Suggested rows (emergency first, bills, ₹500 each, nearest goal). */
  suggestion: SipRow[];
  pending: boolean;
  error: string;
  onSave: (rows: SipRow[], note: string) => void;
}) {
  const [editing, setEditing] = useState<{
    row: SipRow;
    isNew: boolean;
  } | null>(null);
  const [confirmSuggest, setConfirmSuggest] = useState(false);
  const status = sipStatus(rows, budgetMonthly);
  const goalName = (id: string | null) =>
    goals.find((g) => g.id === id)?.label ?? "No goal";
  const newRow = (): SipRow => ({
    id: crypto.randomUUID(),
    investmentId: holdings[0]?.id ?? null,
    label: holdings[0]?.label ?? "",
    amount: 0,
    goalId: null,
  });
  const applySuggestion = () =>
    onSave(
      suggestion.map((r) => ({ ...r, id: crypto.randomUUID() })),
      "Suggested amounts filled in. Change any row.",
    );

  return (
    <section
      id="sips"
      aria-label="Your SIPs"
      className="surface-card space-y-3 rounded-2xl border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Your SIPs</h3>
          <p className="text-xs text-muted-foreground">
            {budgetMonthly !== null
              ? `Save & invest ${formatINR(budgetMonthly)} a month`
              : "No salary right now. Set amounts for when it starts."}
          </p>
        </div>
        <span className="tabular shrink-0 text-right text-sm font-semibold">
          {formatINR(status.assigned)}
          <span className="block text-xs font-normal text-muted-foreground">
            a month
          </span>
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add the SIPs you run, or tap Suggest amounts to start from a split.
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                aria-label={`Edit ${r.label} SIP`}
                disabled={pending}
                onClick={() => setEditing({ row: r, isNew: false })}
                className="flex min-h-12 w-full items-center gap-3 py-2 text-left text-sm hover:text-primary"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 break-words font-medium">
                    {r.label}
                    {r.locked && (
                      <Lock
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-label="Locked"
                      />
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    For: {goalName(r.goalId)}
                  </span>
                </span>
                <span className="tabular shrink-0">{formatINR(r.amount)}</span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {budgetMonthly !== null && rows.length > 0 && (
        <p
          className={cn(
            "text-sm",
            status.over > 0
              ? "text-danger"
              : status.left > 0
                ? "text-warning"
                : "text-success",
          )}
          role={status.over > 0 ? "alert" : undefined}
        >
          {status.over > 0
            ? `${formatINR(status.over)} more than your budget sets aside.`
            : status.left > 0
              ? `${formatINR(status.left)} left to assign.`
              : `All ${formatINR(budgetMonthly)} assigned.`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending || rows.length >= 50}
          onClick={() => setEditing({ row: newRow(), isNew: true })}
        >
          <Plus className="size-4" aria-hidden /> Add SIP
        </Button>
        {suggestion.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              rows.length ? setConfirmSuggest(true) : applySuggestion()
            }
          >
            <Sparkles className="size-4" aria-hidden /> Suggest amounts
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        When Save & invest changes, unlocked SIPs change with it. These are
        plans only; set up SIPs with your provider.
      </p>
      {error && !editing && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {editing && (
        <SipSheet
          row={editing.row}
          isNew={editing.isNew}
          holdings={holdings}
          goals={goals}
          pending={pending}
          error={error}
          onClose={() => !pending && setEditing(null)}
          onSave={(row) => {
            onSave(
              editing.isNew
                ? [...rows, row]
                : rows.map((r) => (r.id === row.id ? row : r)),
              "SIPs saved.",
            );
            setEditing(null);
          }}
          onRemove={() => {
            onSave(
              rows.filter((r) => r.id !== editing.row.id),
              `Removed ${editing.row.label}.`,
            );
            setEditing(null);
          }}
        />
      )}
      {confirmSuggest && (
        <Sheet
          title="Replace with suggested amounts?"
          onClose={() => setConfirmSuggest(false)}
        >
          <div className="space-y-4">
            <p className="text-sm">
              Your SIP rows are replaced with a split: emergency fund first,
              then bills, ₹500 for every other goal, then the nearest goal. You
              can change any row afterwards.
            </p>
            <Button
              className="w-full"
              disabled={pending}
              onClick={() => {
                setConfirmSuggest(false);
                applySuggestion();
              }}
            >
              Replace
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setConfirmSuggest(false)}
            >
              Keep mine
            </Button>
          </div>
        </Sheet>
      )}
    </section>
  );
}

const OTHER = "__other__";

function SipSheet({
  row,
  isNew,
  holdings,
  goals,
  pending,
  error,
  onClose,
  onSave,
  onRemove,
}: {
  row: SipRow;
  isNew: boolean;
  holdings: Option[];
  goals: Option[];
  pending: boolean;
  error: string;
  onClose: () => void;
  onSave: (row: SipRow) => void;
  onRemove: () => void;
}) {
  const [fund, setFund] = useState(row.investmentId ?? OTHER);
  const [label, setLabel] = useState(row.investmentId ? "" : row.label);
  const [amount, setAmount] = useState<number | null>(
    isNew ? null : row.amount,
  );
  const [goalId, setGoalId] = useState(row.goalId ?? "");
  const [locked, setLocked] = useState(!!row.locked);
  const name =
    fund === OTHER
      ? label.trim()
      : (holdings.find((h) => h.id === fund)?.label ?? "");
  return (
    <Sheet title={isNew ? "Add a SIP" : row.label} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name || amount === null) return;
          onSave({
            ...row,
            investmentId: fund === OTHER ? null : fund,
            label: name.slice(0, 80),
            amount,
            goalId: goalId || null,
            locked: locked || undefined,
          });
        }}
      >
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          <Field label="Fund or account" htmlFor="sip-fund">
            <Select
              id="sip-fund"
              value={fund}
              onChange={(e) => setFund(e.target.value)}
            >
              {holdings.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
              <option value={OTHER}>Something else</option>
            </Select>
          </Field>
          {fund === OTHER && (
            <Field label="Name" htmlFor="sip-label">
              <Input
                id="sip-label"
                maxLength={80}
                value={label}
                placeholder="e.g. A new index fund"
                onChange={(e) => setLabel(e.target.value)}
              />
            </Field>
          )}
          <Field label="Monthly amount" htmlFor="sip-amount">
            <MoneyInput id="sip-amount" value={amount} onChange={setAmount} />
          </Field>
          <Field label="For goal" htmlFor="sip-goal">
            <Select
              id="sip-goal"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
            >
              <option value="">No goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={locked}
              onChange={(e) => setLocked(e.target.checked)}
            />
            Keep this amount when Save & invest changes
          </label>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={!name || amount === null}
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
              Remove this SIP
            </Button>
          )}
        </fieldset>
      </form>
    </Sheet>
  );
}
