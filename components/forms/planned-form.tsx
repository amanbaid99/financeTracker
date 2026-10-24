"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { savePlanned } from "@/lib/actions";
import { formatINR } from "@/lib/format";
import { Field } from "./field";
import { RowCard } from "./row-card";
import { StepShell } from "./step-shell";

export interface PlannedRowState {
  id?: string;
  name: string;
  amount: number | null;
  everyMonths: number;
  nextDue: string;
  inBudget: boolean;
}

const PRESETS: { name: string; everyMonths: number }[] = [
  { name: "Gym membership", everyMonths: 12 },
  { name: "Bike service and repairs", everyMonths: 6 },
  { name: "Car service", everyMonths: 12 },
  { name: "Vehicle insurance", everyMonths: 12 },
  { name: "Appliance servicing (AC, RO)", everyMonths: 12 },
  { name: "Festivals and gifts", everyMonths: 12 },
  { name: "School fees (term)", everyMonths: 6 },
  { name: "Subscriptions (yearly)", everyMonths: 12 },
];

const EVERY: { value: number; label: string }[] = [
  { value: 1, label: "Every month" },
  { value: 2, label: "Every 2 months" },
  { value: 3, label: "Every 3 months" },
  { value: 4, label: "Every 4 months" },
  { value: 6, label: "Every 6 months" },
  { value: 12, label: "Every year" },
  { value: 24, label: "Every 2 years" },
  { value: 36, label: "Every 3 years" },
];

export function PlannedForm({ initial, next }: { initial: PlannedRowState[]; next: string }) {
  const [rows, setRows] = useState<PlannedRowState[]>(initial);
  const update = (i: number, patch: Partial<PlannedRowState>) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const monthly = rows
    .filter((r) => r.inBudget)
    .reduce((s, r) => s + Math.round((r.amount ?? 0) / Math.max(1, r.everyMonths)), 0);
  const unused = PRESETS.filter((p) => !rows.some((r) => r.name === p.name));
  const add = (name = "", everyMonths = 12) =>
    setRows((rs) => [...rs, { name, amount: null, everyMonths, nextDue: "", inBudget: true }]);

  return (
    <StepShell
      optional={false}
      editing
      next={next}
      back={next}
      onSave={() =>
        savePlanned(
          rows
            .filter((r) => (r.amount ?? 0) > 0)
            .map((r) => ({
              id: r.id ?? null,
              name: r.name.trim() || "Planned expense",
              amount: r.amount ?? 0,
              everyMonths: r.everyMonths,
              nextDue: r.nextDue || null,
              inBudget: r.inBudget,
            })),
        )
      }
    >
      <p className="text-sm text-muted-foreground">
        Costs that come round every few months. Tracker sets aside a small amount each month so they never catch you
        out.
      </p>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unused.map((p) => (
            <Button key={p.name} type="button" variant="outline" size="sm" onClick={() => add(p.name, p.everyMonths)}>
              <Plus /> {p.name}
            </Button>
          ))}
        </div>
      )}
      {rows.map((r, i) => (
        <RowCard
          key={r.id ?? i}
          title={r.name || "Planned expense"}
          onRemove={() => setRows((rs) => rs.filter((_, k) => k !== i))}
        >
          <Field label="What for" htmlFor={`pl-name-${i}`}>
            <Input id={`pl-name-${i}`} maxLength={60} value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
          </Field>
          <Field label="Amount each time" htmlFor={`pl-amt-${i}`}>
            <MoneyInput id={`pl-amt-${i}`} value={r.amount} onChange={(v) => update(i, { amount: v })} />
          </Field>
          <Field label="How often" htmlFor={`pl-every-${i}`}>
            <Select
              id={`pl-every-${i}`}
              value={r.everyMonths}
              onChange={(e) => update(i, { everyMonths: Number(e.target.value) })}
            >
              {EVERY.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Next due" htmlFor={`pl-due-${i}`} hint="Shows up in This month when it's due.">
            <Input
              id={`pl-due-${i}`}
              type="date"
              value={r.nextDue}
              onChange={(e) => update(i, { nextDue: e.target.value })}
            />
          </Field>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--primary)]"
              checked={r.inBudget}
              onChange={(e) => update(i, { inBudget: e.target.checked })}
            />
            <span>
              Save for it monthly
              {(r.amount ?? 0) > 0 && `: ${formatINR(Math.round((r.amount ?? 0) / Math.max(1, r.everyMonths)))} a month`}
            </span>
          </label>
        </RowCard>
      ))}
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={() => add()}>
          <Plus /> Add your own
        </Button>
        <p className="tabular text-sm">
          Set aside <span className="font-semibold">{formatINR(monthly)}</span>/month
        </p>
      </div>
    </StepShell>
  );
}
