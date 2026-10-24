"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { saveCards } from "@/lib/actions";
import { formatINR } from "@/lib/format";
import { Field } from "./field";
import { RowCard } from "./row-card";
import { StepShell } from "./step-shell";

export interface CardRowState {
  id?: string;
  label: string;
  outstanding: number | null;
  statementDay: number | null;
  dueDay: number | null;
}

const empty = (): CardRowState => ({ label: "", outstanding: null, statementDay: null, dueDay: null });

function DaySelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <Select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Not sure</option>
      {Array.from({ length: 31 }, (_, k) => (
        <option key={k + 1} value={k + 1}>
          {k + 1}
        </option>
      ))}
    </Select>
  );
}

export function CardsForm({ initial, next }: { initial: CardRowState[]; next: string }) {
  const [rows, setRows] = useState<CardRowState[]>(initial.length ? initial : [empty()]);
  const update = (i: number, patch: Partial<CardRowState>) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const total = rows.reduce((s, r) => s + (r.outstanding ?? 0), 0);

  return (
    <StepShell
      optional={false}
      editing
      next={next}
      back={next}
      onSave={() =>
        saveCards(
          rows
            .filter((r) => r.label.trim() || (r.outstanding ?? 0) > 0)
            .map((r, i) => ({
              id: r.id ?? null,
              label: r.label.trim() || `Card ${i + 1}`,
              outstanding: r.outstanding ?? 0,
              statementDay: r.statementDay,
              dueDay: r.dueDay,
            })),
        )
      }
    >
      <p className="text-sm text-muted-foreground">
        Cards you pay in full every month. What you owe on them isn&apos;t debt, but it&apos;s money already spoken
        for, so it&apos;s kept aside from your bank balance. If you carry a balance over, add it under Loans and cards
        instead.
      </p>
      {rows.map((r, i) => (
        <RowCard
          key={r.id ?? i}
          title={r.label || `Card ${i + 1}`}
          onRemove={() => setRows((rs) => rs.filter((_, k) => k !== i))}
        >
          <Field label="Card nickname" htmlFor={`card-label-${i}`} hint="e.g. Travel card. Never the card number.">
            <Input
              id={`card-label-${i}`}
              maxLength={40}
              value={r.label}
              onChange={(e) => update(i, { label: e.target.value })}
            />
          </Field>
          <Field
            label="Total outstanding now"
            htmlFor={`card-os-${i}`}
            tip="Everything you currently owe on this card, billed and not yet billed."
          >
            <MoneyInput id={`card-os-${i}`} value={r.outstanding} onChange={(v) => update(i, { outstanding: v })} />
          </Field>
          <Field label="Bill generation day" htmlFor={`card-stmt-${i}`}>
            <DaySelect id={`card-stmt-${i}`} value={r.statementDay} onChange={(v) => update(i, { statementDay: v })} />
          </Field>
          <Field label="Payment due day" htmlFor={`card-due-${i}`}>
            <DaySelect id={`card-due-${i}`} value={r.dueDay} onChange={(v) => update(i, { dueDay: v })} />
          </Field>
        </RowCard>
      ))}
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={() => setRows((rs) => [...rs, empty()])}>
          <Plus /> Add a card
        </Button>
        <p className="tabular text-sm">
          Total <span className="font-semibold">{formatINR(total)}</span>
        </p>
      </div>
    </StepShell>
  );
}
