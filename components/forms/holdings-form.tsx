"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { saveHoldings } from "@/lib/actions";
import { categoryLabel, defaultCategoryForKind, HOLDING_CATEGORIES } from "@/lib/engine/categories";
import { addMonths, todayIST } from "@/lib/engine/dates";
import type { GoalType, HoldingKind } from "@/lib/engine/types";
import { GOAL_TYPE_LABELS, HOLDING_KIND_LABELS } from "@/lib/labels";
import { Field } from "./field";
import { NoneCheckbox, RowCard } from "./row-card";
import { StepShell } from "./step-shell";

/** "none", a goal id (100% linked), "split" across goals, or "new" goal. */
type GoalChoice = string;

export interface HoldingRowState {
  id?: string;
  kind: HoldingKind;
  name: string;
  category: string;
  currentValue: number | null;
  monthlySip: number | null;
  /** Kept as text while typing, e.g. "10" or "7.5". */
  sipStepUpPct: string;
  /** Empty means "use the category default". */
  expectedReturn: string;
  goal: GoalChoice;
  initialGoal: GoalChoice;
  newGoal?: { name: string; type: GoalType; targetToday: number | null; targetDate: string; noDeadline?: boolean };
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const empty = (kind: HoldingKind = "savings"): HoldingRowState => ({
  kind,
  name: "",
  category: defaultCategoryForKind(kind),
  currentValue: null,
  monthlySip: null,
  sipStepUpPct: "",
  expectedReturn: "",
  goal: "none",
  initialGoal: "none",
});

export function HoldingsForm({
  initial,
  answered,
  next,
  back,
  editing,
  goals,
  defaultReturns,
  optional = true,
  saveLabel,
}: {
  initial: HoldingRowState[];
  answered: boolean;
  next: string;
  back: string | null;
  editing: boolean;
  goals: { id: string; name: string }[];
  defaultReturns: Record<string, number>;
  optional?: boolean;
  saveLabel?: string;
}) {
  const [rows, setRows] = useState<HoldingRowState[]>(initial.length ? initial : answered ? [] : [empty()]);
  const [none, setNone] = useState(answered && initial.length === 0);
  const update = (i: number, patch: Partial<HoldingRowState>) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const defaultReturn = (category: string) => defaultReturns[category] ?? defaultReturns.other ?? 7;

  function goalLink(r: HoldingRowState) {
    if (r.goal === "new" && r.newGoal) {
      return {
        mode: "new" as const,
        name: r.newGoal.name || GOAL_TYPE_LABELS[r.newGoal.type],
        type: r.newGoal.type,
        targetToday: r.newGoal.targetToday ?? 0,
        targetDate: r.newGoal.noDeadline ? null : r.newGoal.targetDate,
      };
    }
    if (r.goal === r.initialGoal || r.goal === "split") return undefined;
    if (r.goal === "none") return { mode: "none" as const };
    return { mode: "existing" as const, goalId: r.goal };
  }

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
                : rows.map((r) => {
                    const ret = r.expectedReturn === "" ? null : Number(r.expectedReturn);
                    return {
                      id: r.id ?? null,
                      kind: r.kind,
                      name: r.name || null,
                      category: r.category || null,
                      currentValue: r.currentValue ?? 0,
                      monthlySip: r.monthlySip,
                      sipStepUpPct: r.sipStepUpPct === "" ? null : Number(r.sipStepUpPct),
                      // Store only a figure that differs from the category default.
                      expectedReturnPct: ret === null || ret === defaultReturn(r.category) ? null : ret,
                      goalLink: goalLink(r),
                    };
                  }),
            )
      }
    >
      <p className="text-sm text-muted-foreground">
        Start with your bank balance. Add investments you already hold and tell us what each one is for. We never
        suggest switching to a specific fund.
      </p>
      <NoneCheckbox checked={none} onChange={setNone} label="No savings yet" />
      {!none &&
        rows.map((r, i) => {
          const def = defaultReturn(r.category);
          const customised = r.expectedReturn !== "";
          return (
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
              <Field
                label="Category"
                htmlFor={`h-cat-${i}`}
                tip="Liquid categories (savings, FDs, liquid funds) count toward your emergency fund."
              >
                <Select id={`h-cat-${i}`} value={r.category} onChange={(e) => update(i, { category: e.target.value })}>
                  {HOLDING_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Your label (optional)"
                htmlFor={`h-name-${i}`}
                hint="Anything that helps you recognise it. No account numbers."
              >
                <Input
                  id={`h-name-${i}`}
                  value={r.name}
                  maxLength={80}
                  onChange={(e) => update(i, { name: e.target.value })}
                />
              </Field>
              <Field label="Current value" htmlFor={`h-val-${i}`}>
                <MoneyInput id={`h-val-${i}`} value={r.currentValue} onChange={(v) => update(i, { currentValue: v })} />
              </Field>
              <Field
                label="Monthly SIP or deposit"
                htmlFor={`h-sip-${i}`}
                tip="A systematic investment plan (SIP) is a fixed amount invested automatically every month."
              >
                <MoneyInput id={`h-sip-${i}`} value={r.monthlySip} onChange={(v) => update(i, { monthlySip: v })} />
              </Field>
              {(r.monthlySip ?? 0) > 0 && (
                <Field
                  label="Yearly step-up (%)"
                  htmlFor={`h-step-${i}`}
                  tip="A step-up SIP raises the monthly amount by a fixed percentage every year, usually in line with your pay rise. 10% is common."
                  hint={
                    r.sipStepUpPct && Number(r.sipStepUpPct) > 0
                      ? `Next year: ${inr.format(Math.round((r.monthlySip ?? 0) * (1 + Number(r.sipStepUpPct) / 100)))}/month`
                      : "Leave blank if your SIP stays the same."
                  }
                >
                  <Input
                    id={`h-step-${i}`}
                    inputMode="decimal"
                    placeholder="e.g. 10"
                    value={r.sipStepUpPct}
                    onChange={(e) => update(i, { sipStepUpPct: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) })}
                  />
                </Field>
              )}
              <Field
                label="Expected return (% a year)"
                htmlFor={`h-ret-${i}`}
                tip="Used to project how this money grows toward its goal. Pre-filled with a typical long-run return for the category. It is a planning assumption, not live market data or a promise."
                hint={customised ? undefined : `Typical for ${categoryLabel(r.category).toLowerCase()}. Change it if you like.`}
              >
                <div className="flex items-center gap-2">
                  <Input
                    id={`h-ret-${i}`}
                    inputMode="decimal"
                    value={customised ? r.expectedReturn : String(def)}
                    onChange={(e) => update(i, { expectedReturn: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) })}
                  />
                  {customised && Number(r.expectedReturn) !== def && (
                    <Button type="button" variant="link" size="sm" onClick={() => update(i, { expectedReturn: "" })}>
                      Use {def}%
                    </Button>
                  )}
                </div>
              </Field>
              <Field label="Goal for this money" htmlFor={`h-goal-${i}`}>
                {r.goal === "split" ? (
                  <p className="text-sm text-muted-foreground">
                    Split across several goals. Change the split on the Holdings page.
                  </p>
                ) : (
                  <Select
                    id={`h-goal-${i}`}
                    value={r.goal}
                    onChange={(e) => {
                      const goal = e.target.value;
                      update(i, {
                        goal,
                        newGoal:
                          goal === "new"
                            ? (r.newGoal ?? {
                                name: "",
                                type: "custom",
                                targetToday: null,
                                targetDate: addMonths(todayIST(), 36),
                              })
                            : r.newGoal,
                      });
                    }}
                  >
                    <option value="none">Not for a specific goal</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                    <option value="new">+ New goal…</option>
                  </Select>
                )}
              </Field>
              {r.goal === "new" && r.newGoal && (
                <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:col-span-2 sm:grid-cols-2">
                  <Field label="Goal name" htmlFor={`h-gname-${i}`}>
                    <Input
                      id={`h-gname-${i}`}
                      maxLength={60}
                      placeholder={GOAL_TYPE_LABELS[r.newGoal.type]}
                      value={r.newGoal.name}
                      onChange={(e) => update(i, { newGoal: { ...r.newGoal!, name: e.target.value } })}
                    />
                  </Field>
                  <Field label="Goal type" htmlFor={`h-gtype-${i}`}>
                    <Select
                      id={`h-gtype-${i}`}
                      value={r.newGoal.type}
                      onChange={(e) => update(i, { newGoal: { ...r.newGoal!, type: e.target.value as GoalType } })}
                    >
                      {Object.entries(GOAL_TYPE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Target amount (today's ₹)"
                    htmlFor={`h-gtarget-${i}`}
                    tip="What the goal would cost today. We add inflation to find the future amount."
                  >
                    <MoneyInput
                      id={`h-gtarget-${i}`}
                      value={r.newGoal.targetToday}
                      onChange={(v) => update(i, { newGoal: { ...r.newGoal!, targetToday: v } })}
                    />
                  </Field>
                  <div className="space-y-2">
                    {!r.newGoal.noDeadline && (
                      <Field label="Target date" htmlFor={`h-gdate-${i}`}>
                        <Input
                          id={`h-gdate-${i}`}
                          type="date"
                          value={r.newGoal.targetDate}
                          onChange={(e) => update(i, { newGoal: { ...r.newGoal!, targetDate: e.target.value } })}
                        />
                      </Field>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        checked={Boolean(r.newGoal.noDeadline)}
                        onChange={(e) => update(i, { newGoal: { ...r.newGoal!, noDeadline: e.target.checked } })}
                      />
                      No fixed date
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    All of this investment will count toward the new goal. You can split it later.
                  </p>
                </div>
              )}
            </RowCard>
          );
        })}
      {!none && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setRows((rs) => [...rs, empty(rs.length ? "mutual_fund" : "savings")])}
        >
          <Plus /> Add another
        </Button>
      )}
    </StepShell>
  );
}
