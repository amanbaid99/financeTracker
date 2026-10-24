"use client";

import { INCOME_TYPE_LABELS } from "@/lib/labels";

import { Plus } from "lucide-react";
import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { saveIncomes } from "@/lib/actions";
import { addMonths, todayIST } from "@/lib/engine/dates";
import type { IncomeType } from "@/lib/engine/types";
import { formatDate } from "@/lib/format";
import { Field } from "./field";
import { RowCard } from "./row-card";
import { StepShell } from "./step-shell";

export interface IncomeRowState {
  id?: string;
  label: string;
  type: IncomeType;
  amountMonthly: number | null;
  fixedMonthly: number | null;
  isGross: boolean;
  isPrimary: boolean;
  history: (number | null)[];
}


const TIPS: Partial<Record<IncomeType, string>> = {
  variable_salary:
    "Your fixed pay (or your lowest recent month) becomes your base. Anything above it is split: 50% to your next step, 30% to goals, 20% for wants.",
  freelance:
    "We set aside 25% for tax first, then pay you a steady salary based on your leanest months. The rest is split like a bonus.",
  business:
    "We set aside 25% for tax first, then pay you a steady salary based on your leanest months. The rest is split like a bonus.",
  bonus: "One-off money never goes into your monthly base. It's split 50% to your next step, 30% goals, 20% wants.",
};

const empty = (): IncomeRowState => ({
  label: "",
  type: "stable_salary",
  amountMonthly: null,
  fixedMonthly: null,
  isGross: false,
  isPrimary: false,
  history: Array(6).fill(null),
});

export function IncomeForm({
  initial,
  next,
  back,
  editing,
}: {
  initial: IncomeRowState[];
  next: string;
  back: string | null;
  editing: boolean;
}) {
  const [rows, setRows] = useState<IncomeRowState[]>(initial.length ? initial : [{ ...empty(), label: "Salary" }]);
  const thisMonth = `${todayIST().slice(0, 7)}-01`;
  const monthLabels = Array.from({ length: 6 }, (_, k) => formatDate(addMonths(thisMonth, -(k + 1))).slice(2));
  const salaryCount = rows.filter((r) => r.type === "stable_salary" || r.type === "variable_salary").length;

  const update = (i: number, patch: Partial<IncomeRowState>) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <StepShell
      optional={false}
      editing={editing}
      next={next}
      back={back}
      onSave={() =>
        saveIncomes(
          rows.map((r) => ({
            id: r.id ?? null,
            label: r.label || INCOME_TYPE_LABELS[r.type],
            type: r.type,
            amountMonthly:
              r.amountMonthly ??
              (r.history.filter((h) => h !== null).length
                ? Math.round(
                    (r.history.filter((h): h is number => h !== null).reduce((s, h) => s + h, 0)) /
                      r.history.filter((h) => h !== null).length,
                  )
                : 0),
            fixedMonthly: r.fixedMonthly,
            isGross: r.isGross,
            isPrimary: r.isPrimary,
            history: r.history,
          })),
        )
      }
    >
      <p className="text-sm text-muted-foreground">
        Add each source of income separately. Use the amount that reaches your bank (in-hand) where you can.
      </p>
      {rows.map((r, i) => {
        const needsHistory = r.type === "variable_salary" || r.type === "freelance" || r.type === "business";
        return (
          <RowCard
            key={r.id ?? i}
            title={r.label || `Income ${i + 1}`}
            onRemove={rows.length > 1 ? () => setRows((rs) => rs.filter((_, k) => k !== i)) : undefined}
          >
            <Field label="Name" htmlFor={`inc-label-${i}`}>
              <Input
                id={`inc-label-${i}`}
                value={r.label}
                placeholder="e.g. Salary"
                onChange={(e) => update(i, { label: e.target.value })}
              />
            </Field>
            <Field label="Type" htmlFor={`inc-type-${i}`} tip={TIPS[r.type]}>
              <Select
                id={`inc-type-${i}`}
                value={r.type}
                onChange={(e) => update(i, { type: e.target.value as IncomeType })}
              >
                {Object.entries(INCOME_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={r.type === "bonus" ? "Amount" : needsHistory ? "Typical month (optional)" : "Monthly amount"}
              htmlFor={`inc-amt-${i}`}
              hint={needsHistory ? "Leave blank and we'll average the months below." : undefined}
            >
              <MoneyInput
                id={`inc-amt-${i}`}
                value={r.amountMonthly}
                onChange={(v) => update(i, { amountMonthly: v })}
              />
            </Field>
            {r.type === "variable_salary" && (
              <Field
                label="Fixed part each month"
                htmlFor={`inc-fixed-${i}`}
                tip="The part of your salary that doesn't depend on targets. Leave blank if it all varies."
              >
                <MoneyInput
                  id={`inc-fixed-${i}`}
                  value={r.fixedMonthly}
                  onChange={(v) => update(i, { fixedMonthly: v })}
                />
              </Field>
            )}
            {needsHistory && (
              <div className="space-y-2 sm:col-span-2">
                <p className="text-sm font-medium">Last 6 months (optional, sharpens your base)</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {monthLabels.map((label, k) => (
                    <MoneyInput
                      key={label}
                      aria-label={`${r.label || "Income"} for ${label}`}
                      placeholder={label}
                      value={r.history[k]}
                      onChange={(v) => update(i, { history: r.history.map((h, x) => (x === k ? v : h)) })}
                    />
                  ))}
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={r.isGross}
                onChange={(e) => update(i, { isGross: e.target.checked })}
              />
              This amount is before tax (gross)
            </label>
            {salaryCount > 1 && (r.type === "stable_salary" || r.type === "variable_salary") && (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="radio"
                  name="primary-job"
                  className="size-4 accent-[var(--primary)]"
                  checked={r.isPrimary}
                  onChange={() => setRows((rs) => rs.map((x, k) => ({ ...x, isPrimary: k === i })))}
                />
                This is my main job
              </label>
            )}
          </RowCard>
        );
      })}
      <Button type="button" variant="outline" onClick={() => setRows((rs) => [...rs, empty()])}>
        <Plus /> Add another income
      </Button>
    </StepShell>
  );
}

export { INCOME_TYPE_LABELS };
