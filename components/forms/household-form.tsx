"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/input";
import { saveHousehold } from "@/lib/actions";
import { Field } from "./field";
import { StepShell } from "./step-shell";

export interface HouseholdInitial {
  maritalStatus: "single" | "married" | "other" | null;
  dependents: number | null;
  soleEarner: boolean | null;
}

export function HouseholdForm({
  initial,
  next,
  back,
  editing,
}: {
  initial: HouseholdInitial;
  next: string;
  back: string | null;
  editing: boolean;
}) {
  const [marital, setMarital] = useState(initial.maritalStatus ?? "");
  const [dependents, setDependents] = useState(initial.dependents?.toString() ?? "0");
  const [sole, setSole] = useState(initial.soleEarner === null ? "" : initial.soleEarner ? "yes" : "no");

  return (
    <StepShell
      optional
      editing={editing}
      next={next}
      back={back}
      onSave={() =>
        saveHousehold({
          maritalStatus: (marital || null) as HouseholdInitial["maritalStatus"],
          dependents: dependents === "" ? null : Number(dependents),
          soleEarner: sole === "" ? null : sole === "yes",
        })
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marital status" htmlFor="marital">
          <Select id="marital" value={marital} onChange={(e) => setMarital(e.target.value)}>
            <option value="">Prefer not to say</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field
          label="People who depend on your income"
          htmlFor="dependents"
          tip="Children, parents or a partner who would struggle without your income."
        >
          <Input
            id="dependents"
            inputMode="numeric"
            value={dependents}
            onChange={(e) => setDependents(e.target.value.replace(/\D/g, "").slice(0, 2))}
          />
        </Field>
        <Field label="Are you the only earner at home?" htmlFor="sole">
          <Select id="sole" value={sole} onChange={(e) => setSole(e.target.value)}>
            <option value="">Not sure</option>
            <option value="yes">Yes</option>
            <option value="no">No, someone else earns too</option>
          </Select>
        </Field>
      </div>
    </StepShell>
  );
}
