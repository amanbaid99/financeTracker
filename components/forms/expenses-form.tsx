"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveExpenses } from "@/lib/actions";
import { formatINR } from "@/lib/format";
import { StepShell } from "./step-shell";

export interface ExpenseRowState {
  id?: string;
  category: string;
  amountMonthly: number | null;
  isEssential: boolean;
  preset?: boolean;
}

const PRESETS = ["Rent", "Groceries", "Utilities and phone", "Transport", "Family support", "Other fixed costs"];

export function ExpensesForm({
  initial,
  next,
  back,
  editing,
}: {
  initial: ExpenseRowState[];
  next: string;
  back: string | null;
  editing: boolean;
}) {
  const [rows, setRows] = useState<ExpenseRowState[]>(() => {
    const existing = new Set(initial.map((r) => r.category));
    return [
      ...initial,
      ...PRESETS.filter((p) => !existing.has(p)).map((p) => ({
        category: p,
        amountMonthly: null,
        isEssential: true,
        preset: true,
      })),
    ];
  });
  const total = rows.reduce((s, r) => s + (r.amountMonthly ?? 0), 0);
  const update = (i: number, patch: Partial<ExpenseRowState>) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <StepShell
      optional
      editing={editing}
      next={next}
      back={back}
      onSave={() =>
        total === 0
          ? { ok: false, error: "Add at least one cost, or skip for now and we'll estimate." }
          : saveExpenses(
          rows
            .filter((r) => (r.amountMonthly ?? 0) > 0 && r.category.trim())
            .map((r) => ({
              id: r.id ?? null,
              category: r.category.trim(),
              amountMonthly: r.amountMonthly ?? 0,
              isEssential: true,
            })),
        )
      }
    >
      <p className="text-sm text-muted-foreground">
        Fixed monthly costs you can&apos;t easily skip. Loan EMIs go in the loans step and insurance premiums in the
        insurance step, so nothing is counted twice.
      </p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.id ?? `${r.category}-${i}`} className="flex items-center gap-2">
            {r.preset ? (
              <span className="min-w-0 flex-1 text-sm">{r.category}</span>
            ) : (
              <Input
                aria-label="Expense name"
                className="flex-1"
                value={r.category}
                placeholder="e.g. School fees"
                onChange={(e) => update(i, { category: e.target.value })}
              />
            )}
            <MoneyInput
              className="w-36 shrink-0 sm:w-44"
              aria-label={`${r.category || "Expense"} per month`}
              value={r.amountMonthly}
              onChange={(v) => update(i, { amountMonthly: v })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${r.category || "expense"}`}
              onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setRows((rs) => [...rs, { category: "", amountMonthly: null, isEssential: true }])}
        >
          <Plus /> Add a cost
        </Button>
        <p className="tabular text-sm">
          Total <span className="font-semibold">{formatINR(total)}</span>/month
        </p>
      </div>
    </StepShell>
  );
}
