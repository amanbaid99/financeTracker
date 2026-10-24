"use client";

import { HOLDING_KIND_LABELS } from "@/lib/labels";

import { Plus } from "lucide-react";
import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { saveHoldings } from "@/lib/actions";
import { defaultCategoryForKind, HOLDING_CATEGORIES } from "@/lib/engine/categories";
import type { HoldingKind } from "@/lib/engine/types";
import { Field } from "./field";
import { NoneCheckbox, RowCard } from "./row-card";
import { StepShell } from "./step-shell";

export interface HoldingRowState {
  id?: string;
  kind: HoldingKind;
  name: string;
  category: string;
  currentValue: number | null;
  monthlySip: number | null;
}


const empty = (kind: HoldingKind = "savings"): HoldingRowState => ({
  kind,
  name: "",
  category: defaultCategoryForKind(kind),
  currentValue: null,
  monthlySip: null,
});

export function HoldingsForm({
  initial,
  answered,
  next,
  back,
  editing,
  optional = true,
  saveLabel,
}: {
  initial: HoldingRowState[];
  answered: boolean;
  next: string;
  back: string | null;
  editing: boolean;
  optional?: boolean;
  saveLabel?: string;
}) {
  const [rows, setRows] = useState<HoldingRowState[]>(initial.length ? initial : answered ? [] : [empty()]);
  const [none, setNone] = useState(answered && initial.length === 0);
  const update = (i: number, patch: Partial<HoldingRowState>) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <StepShell
      optional={optional}
      editing={editing}
      next={next}
      back={back}
      saveLabel={saveLabel}
      onSave={() =>
        !none && rows.length === 0
          ? { ok: false, error: "Add your savings, tick “No savings yet”, or skip for now." }
          : saveHoldings(
              none
                ? []
                : rows.map((r) => ({
                    id: r.id ?? null,
                    kind: r.kind,
                    name: r.name || null,
                    category: r.category || null,
                    currentValue: r.currentValue ?? 0,
                    monthlySip: r.monthlySip,
                  })),
            )
      }
    >
      <p className="text-sm text-muted-foreground">
        Start with your bank balance. Add investments you already hold so we can map them to goals. We never suggest
        switching to a specific fund.
      </p>
      <NoneCheckbox checked={none} onChange={setNone} label="No savings yet" />
      {!none &&
        rows.map((r, i) => (
          <RowCard
            key={r.id ?? i}
            title={r.name || HOLDING_KIND_LABELS[r.kind]}
            onRemove={() => setRows((rs) => rs.filter((_, k) => k !== i))}
          >
            <Field label="Type" htmlFor={`h-kind-${i}`}>
              <Select
                id={`h-kind-${i}`}
                value={r.kind}
                onChange={(e) => {
                  const kind = e.target.value as HoldingKind;
                  update(i, { kind, category: defaultCategoryForKind(kind) });
                }}
              >
                {Object.entries(HOLDING_KIND_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category" htmlFor={`h-cat-${i}`} tip="Liquid categories (savings, FDs, liquid funds) count toward your emergency fund.">
              <Select id={`h-cat-${i}`} value={r.category} onChange={(e) => update(i, { category: e.target.value })}>
                {HOLDING_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Your label (optional)" htmlFor={`h-name-${i}`} hint="Anything that helps you recognise it. No account numbers.">
              <Input id={`h-name-${i}`} value={r.name} maxLength={80} onChange={(e) => update(i, { name: e.target.value })} />
            </Field>
            <Field label="Current value" htmlFor={`h-val-${i}`}>
              <MoneyInput id={`h-val-${i}`} value={r.currentValue} onChange={(v) => update(i, { currentValue: v })} />
            </Field>
            <Field label="Monthly SIP or deposit" htmlFor={`h-sip-${i}`} tip="A systematic investment plan (SIP) is a fixed amount invested automatically every month.">
              <MoneyInput id={`h-sip-${i}`} value={r.monthlySip} onChange={(v) => update(i, { monthlySip: v })} />
            </Field>
          </RowCard>
        ))}
      {!none && (
        <Button type="button" variant="outline" onClick={() => setRows((rs) => [...rs, empty(rs.length ? "mutual_fund" : "savings")])}>
          <Plus /> Add another
        </Button>
      )}
    </StepShell>
  );
}

export { HOLDING_KIND_LABELS };
