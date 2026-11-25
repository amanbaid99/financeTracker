"use client";
import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import { CompactAllocation } from "@/components/allocation-bar";
import { ASSET_CLASSES } from "@/lib/portfolio";
import {
  equalSplit,
  sipMix,
  sipStatus,
  sipsByGoal,
  type SipRow,
} from "@/lib/budget-sips";
import { cn } from "@/lib/utils";

type GoalOption = {
  id: string;
  label: string;
  /** Funds covering this goal that can take monthly money. */
  vehicles?: { label: string; assetClass: string }[];
};

/**
 * Your SIPs: one line per goal with an amount box. Leave a box empty for ₹0.
 * Nothing is suggested or filled in for you; Save keeps what you typed.
 */
export function BudgetSips({
  rows,
  budgetMonthly,
  goals,
  pending,
  error,
  onSave,
}: {
  rows: SipRow[];
  /** Save & invest a month from the budget, or null with no salary. */
  budgetMonthly: number | null;
  goals: GoalOption[];
  pending: boolean;
  error: string;
  onSave: (rows: SipRow[], note: string) => void;
}) {
  const saved = sipsByGoal(rows);
  const start = () =>
    Object.fromEntries(goals.map((g) => [g.id, saved.get(g.id) ?? null]));
  const [amounts, setAmounts] = useState<Record<string, number | null>>(start);
  const draft: SipRow[] = goals
    .filter((g) => (amounts[g.id] ?? 0) > 0)
    .map((g) => ({
      id: `goal-${g.id}`,
      investmentId: null,
      label: g.label.slice(0, 80),
      amount: amounts[g.id] ?? 0,
      goalId: g.id,
    }));
  const status = sipStatus(draft, budgetMonthly);
  const mix = sipMix(
    goals.map((g) => ({
      amount: amounts[g.id] ?? 0,
      classes: (g.vehicles ?? []).map((v) => v.assetClass),
    })),
  );
  const changed = goals.some(
    (g) => (amounts[g.id] ?? 0) !== (saved.get(g.id) ?? 0),
  );

  return (
    <section
      id="sips"
      aria-label="Your SIPs"
      className="surface-card space-y-3 rounded-2xl border bg-card p-4"
    >
      <h3 className="font-semibold">Your SIPs</h3>
      {status.assigned > 0 && (
        <div>
          <p className="text-sm">
            <span className="tabular font-semibold">
              {formatINR(status.assigned)}
            </span>{" "}
            a month into investments
            {budgetMonthly ? (
              <span className="text-muted-foreground">
                {" "}
                · {Math.round((status.assigned / budgetMonthly) * 100)}% of what
                you save
              </span>
            ) : null}
          </p>
          <CompactAllocation
            label="Where your SIPs go"
            items={mix.map((m) => {
              const c = ASSET_CLASSES.find((x) => x.key === m.key);
              return {
                key: m.key,
                label: c?.label ?? "No fund yet",
                value: m.value,
                share: m.share,
                slot: c?.slot ?? 7,
              };
            })}
          />
        </div>
      )}

      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a goal first, then set a monthly SIP for it here.
        </p>
      ) : (
        <ul className="divide-y">
          {goals.map((g) => (
            <li key={g.id} className="py-2">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor={`sip-${g.id}`}
                  className="min-w-0 break-words text-sm"
                >
                  {g.label}
                </label>
                <div className="w-32 shrink-0">
                  <MoneyInput
                    id={`sip-${g.id}`}
                    aria-label={`${g.label} SIP a month`}
                    value={amounts[g.id] ?? null}
                    onChange={(v) => setAmounts((a) => ({ ...a, [g.id]: v }))}
                  />
                </div>
              </div>
              {(amounts[g.id] ?? 0) > 0 && (g.vehicles?.length ?? 0) > 0 && (
                <ul
                  aria-label={`${g.label} split`}
                  className="mt-2 space-y-1 border-l-2 border-border pl-3"
                >
                  {equalSplit(amounts[g.id] ?? 0, g.vehicles!.length).map(
                    (n, i) => (
                      <li
                        key={i}
                        className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground"
                      >
                        <span className="min-w-0 break-words">
                          {g.vehicles![i].label}
                        </span>
                        <span className="tabular shrink-0">{formatINR(n)}</span>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {budgetMonthly !== null && status.assigned > 0 && (
        <p
          className={cn(
            "text-sm",
            status.over > 0
              ? "text-danger"
              : status.left > 0
                ? "text-warning"
                : "text-success",
          )}
        >
          {status.over > 0
            ? `${formatINR(status.over)} more than your budget sets aside.`
            : status.left > 0
              ? `${formatINR(status.left)} left to assign.`
              : `All ${formatINR(budgetMonthly)} assigned.`}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {changed && (
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={pending}
            onClick={() => onSave(draft, "SIPs saved.")}
          >
            {pending ? "Saving…" : "Save SIPs"}
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => setAmounts(start())}
          >
            Undo
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Plans only. Set up SIPs with your provider.
      </p>
    </section>
  );
}
