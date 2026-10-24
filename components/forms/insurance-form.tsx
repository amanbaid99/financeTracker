"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { saveInsurance } from "@/lib/actions";
import type { InsuranceKind, InsuranceSource } from "@/lib/engine/types";
import { monthName } from "@/lib/format";
import { Field } from "./field";
import { NoneCheckbox, RowCard } from "./row-card";
import { StepShell } from "./step-shell";

export interface InsuranceRowState {
  id?: string;
  kind: InsuranceKind;
  source: InsuranceSource;
  coverAmount: number | null;
  premium: number | null;
  renewalMonth: number | null;
}

const KIND_LABELS: Record<InsuranceKind, string> = {
  health: "Health insurance",
  term: "Term life insurance",
  other: "Other",
};
const SOURCE_LABELS: Record<InsuranceSource, string> = {
  personal: "Bought by me (individual)",
  family: "Family floater I pay for",
  employer: "From my employer",
};

const empty = (kind: InsuranceKind = "health"): InsuranceRowState => ({
  kind,
  source: "personal",
  coverAmount: null,
  premium: null,
  renewalMonth: null,
});

export function InsuranceForm({
  initial,
  answered,
  next,
  back,
  editing,
}: {
  initial: InsuranceRowState[];
  answered: boolean;
  next: string;
  back: string | null;
  editing: boolean;
}) {
  const [rows, setRows] = useState<InsuranceRowState[]>(initial);
  const [none, setNone] = useState(answered && initial.length === 0);
  const update = (i: number, patch: Partial<InsuranceRowState>) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <StepShell
      optional
      editing={editing}
      next={next}
      back={back}
      onSave={() =>
        !none && rows.length === 0
          ? { ok: false, error: "Add a policy, tick “I don't have any”, or skip for now." }
          : saveInsurance(
              none
                ? []
                : rows.map((r) => ({
                    id: r.id ?? null,
                    kind: r.kind,
                    source: r.source,
                    coverAmount: r.coverAmount ?? 0,
                    premium: r.premium,
                    renewalMonth: r.renewalMonth,
                  })),
            )
      }
    >
      <p className="text-sm text-muted-foreground">
        Include cover from your employer too. It helps, but it ends when the job does, so it doesn&apos;t replace your
        own policy.
      </p>
      <NoneCheckbox checked={none} onChange={setNone} label="I don't have any insurance" />
      {!none &&
        rows.map((r, i) => (
          <RowCard
            key={r.id ?? i}
            title={KIND_LABELS[r.kind]}
            onRemove={() => setRows((rs) => rs.filter((_, k) => k !== i))}
          >
            <Field label="Type" htmlFor={`ins-kind-${i}`}>
              <Select
                id={`ins-kind-${i}`}
                value={r.kind}
                onChange={(e) => update(i, { kind: e.target.value as InsuranceKind })}
              >
                {Object.entries(KIND_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Who provides it" htmlFor={`ins-src-${i}`}>
              <Select
                id={`ins-src-${i}`}
                value={r.source}
                onChange={(e) => update(i, { source: e.target.value as InsuranceSource })}
              >
                {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Cover amount" htmlFor={`ins-cover-${i}`} tip="The maximum the policy pays out (sum insured).">
              <MoneyInput id={`ins-cover-${i}`} value={r.coverAmount} onChange={(v) => update(i, { coverAmount: v })} />
            </Field>
            <Field label="Yearly premium" htmlFor={`ins-prem-${i}`} hint="Counted as an essential cost.">
              <MoneyInput id={`ins-prem-${i}`} value={r.premium} onChange={(v) => update(i, { premium: v })} />
            </Field>
            <Field label="Renewal month" htmlFor={`ins-renew-${i}`} hint="We'll remind you before it's due.">
              <Select
                id={`ins-renew-${i}`}
                value={r.renewalMonth ?? ""}
                onChange={(e) => update(i, { renewalMonth: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Not sure</option>
                {Array.from({ length: 12 }, (_, k) => (
                  <option key={k + 1} value={k + 1}>
                    {monthName(k + 1)}
                  </option>
                ))}
              </Select>
            </Field>
          </RowCard>
        ))}
      {!none && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setRows((rs) => [...rs, empty("health")])}>
            <Plus /> Health policy
          </Button>
          <Button type="button" variant="outline" onClick={() => setRows((rs) => [...rs, empty("term")])}>
            <Plus /> Term policy
          </Button>
        </div>
      )}
    </StepShell>
  );
}
