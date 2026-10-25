"use client";

import { Plus, X } from "lucide-react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export interface BillRow {
  key: string;
  name: string;
  amount: number | null;
  everyMonths: number;
  nextDue: string;
}

const PRESETS: { name: string; everyMonths: number }[] = [
  { name: "Health insurance", everyMonths: 12 },
  { name: "Term insurance", everyMonths: 12 },
  { name: "Vehicle insurance", everyMonths: 12 },
  { name: "Gym", everyMonths: 12 },
  { name: "Vehicle service", everyMonths: 6 },
  { name: "Subscriptions", everyMonths: 12 },
];

const EVERY = [
  [1, "Monthly"],
  [3, "Quarterly"],
  [6, "Half-yearly"],
  [12, "Yearly"],
  [24, "Every 2 years"],
] as const;

let counter = 0;
export const newBillKey = () => `b${Date.now()}-${counter++}`;

/** The list of payments a bills fund covers: one compact row each. */
export function BillsEditor({
  rows,
  onChange,
}: {
  rows: BillRow[];
  onChange: (rows: BillRow[]) => void;
}) {
  const set = (key: string, patch: Partial<BillRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (name = "", everyMonths = 12) =>
    onChange([
      ...rows,
      { key: newBillKey(), name, amount: null, everyMonths, nextDue: "" },
    ]);
  const unused = PRESETS.filter(
    (p) => !rows.some((r) => r.name.toLowerCase() === p.name.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Payments this fund covers</p>
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add each payment once. Due dates move on by themselves after you pay.
        </p>
      )}
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.key} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Payment ${i + 1} name`}
                value={r.name}
                onChange={(e) => set(r.key, { name: e.target.value })}
                placeholder="e.g. Health insurance"
                maxLength={60}
                required
              />
              <button
                type="button"
                aria-label={`Remove ${r.name || `payment ${i + 1}`}`}
                onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MoneyInput
                aria-label={`${r.name || `Payment ${i + 1}`} amount`}
                value={r.amount}
                onChange={(v) => set(r.key, { amount: v })}
                placeholder="Amount"
                required
              />
              <Select
                aria-label={`${r.name || `Payment ${i + 1}`} how often`}
                value={r.everyMonths}
                onChange={(e) =>
                  set(r.key, { everyMonths: Number(e.target.value) })
                }
              >
                {EVERY.map(([m, label]) => (
                  <option key={m} value={m}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="shrink-0">Next due</span>
              <Input
                aria-label={`${r.name || `Payment ${i + 1}`} next due`}
                type="date"
                value={r.nextDue}
                onChange={(e) => set(r.key, { nextDue: e.target.value })}
                required
              />
            </label>
          </li>
        ))}
      </ul>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unused.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => add(p.name, p.everyMonths)}
              className="rounded-full border px-3 py-1 text-xs hover:border-primary hover:bg-primary-soft"
            >
              + {p.name}
            </button>
          ))}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => add()}>
        <Plus /> Add a payment
      </Button>
    </div>
  );
}
