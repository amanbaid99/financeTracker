"use client";

import { LIABILITY_LABELS } from "@/lib/labels";

import { Plus } from "lucide-react";
import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { saveLiabilities } from "@/lib/actions";
import type { LiabilityKind } from "@/lib/engine/types";
import { Field } from "./field";
import { NoneCheckbox, RowCard } from "./row-card";
import { StepShell } from "./step-shell";

export interface LiabilityRowState {
  id?: string;
  kind: LiabilityKind;
  label: string;
  outstanding: number | null;
  interestRate: string;
  emi: number | null;
}


const empty = (): LiabilityRowState => ({
  kind: "credit_card",
  label: "",
  outstanding: null,
  interestRate: "",
  emi: null,
});

export function LiabilitiesForm({
  initial,
  answered,
  next,
  back,
  editing,
}: {
  initial: LiabilityRowState[];
  answered: boolean;
  next: string;
  back: string | null;
  editing: boolean;
}) {
  const [rows, setRows] = useState<LiabilityRowState[]>(initial);
  const [none, setNone] = useState(answered && initial.length === 0);
  const update = (i: number, patch: Partial<LiabilityRowState>) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <StepShell
      optional
      editing={editing}
      next={next}
      back={back}
      onSave={() =>
        !none && rows.length === 0
          ? { ok: false, error: "Add a loan, tick “No loans or card dues”, or skip for now." }
          : saveLiabilities(
              none
                ? []
                : rows.map((r) => ({
                    id: r.id ?? null,
                    kind: r.kind,
                    label: r.label || null,
                    outstanding: r.outstanding ?? 0,
                    interestRate: r.interestRate === "" ? null : Number(r.interestRate),
                    emi: r.emi,
                  })),
            )
      }
    >
      <p className="text-sm text-muted-foreground">
        Debt above 10% a year (like credit cards and personal loans) gets paid off before investing. Cards you pay in
        full every month go under Credit cards in My details instead.
      </p>
      <NoneCheckbox checked={none} onChange={setNone} label="No loans or card dues" />
      {!none &&
        rows.map((r, i) => (
          <RowCard
            key={r.id ?? i}
            title={r.label || LIABILITY_LABELS[r.kind]}
            onRemove={() => setRows((rs) => rs.filter((_, k) => k !== i))}
          >
            <Field label="Type" htmlFor={`li-kind-${i}`}>
              <Select
                id={`li-kind-${i}`}
                value={r.kind}
                onChange={(e) => update(i, { kind: e.target.value as LiabilityKind })}
              >
                {Object.entries(LIABILITY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nickname (optional)" htmlFor={`li-label-${i}`} hint="Don't enter card or account numbers.">
              <Input
                id={`li-label-${i}`}
                value={r.label}
                maxLength={60}
                onChange={(e) => update(i, { label: e.target.value })}
              />
            </Field>
            <Field label="Amount still owed" htmlFor={`li-out-${i}`}>
              <MoneyInput id={`li-out-${i}`} value={r.outstanding} onChange={(v) => update(i, { outstanding: v })} />
            </Field>
            <Field
              label="Interest rate (% a year)"
              htmlFor={`li-rate-${i}`}
              tip="Credit cards are often 36-42% a year. Leave blank if unsure."
            >
              <Input
                id={`li-rate-${i}`}
                inputMode="decimal"
                value={r.interestRate}
                onChange={(e) => update(i, { interestRate: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) })}
              />
            </Field>
            <Field label="Monthly EMI" htmlFor={`li-emi-${i}`} tip="Equated monthly instalment: the fixed amount you repay each month.">
              <MoneyInput id={`li-emi-${i}`} value={r.emi} onChange={(v) => update(i, { emi: v })} />
            </Field>
          </RowCard>
        ))}
      {!none && (
        <Button type="button" variant="outline" onClick={() => setRows((rs) => [...rs, empty()])}>
          <Plus /> Add a loan or card
        </Button>
      )}
    </StepShell>
  );
}

export { LIABILITY_LABELS };
