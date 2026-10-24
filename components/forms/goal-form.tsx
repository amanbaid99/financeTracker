"use client";

import { GOAL_TYPE_LABELS } from "@/lib/labels";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { deleteGoal, saveGoal } from "@/lib/actions";
import type { GoalType } from "@/lib/engine/types";
import { Field } from "./field";


export interface GoalFormState {
  id?: string;
  name: string;
  type: GoalType;
  targetToday: number | null;
  targetDate: string;
  /** No fixed date: the app estimates when it's reached. */
  noDeadline: boolean;
  priority: number;
  inflationRate: string;
  savedAmount: number | null;
}

export function GoalForm({
  initial,
  defaultInflation,
  afterSave,
  cancelHref,
}: {
  initial: GoalFormState;
  defaultInflation: Record<string, number>;
  afterSave: string | "goal";
  cancelHref: string;
}) {
  const router = useRouter();
  const [g, setG] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = (patch: Partial<GoalFormState>) => setG((x) => ({ ...x, ...patch }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      const res = await saveGoal({
        id: g.id ?? null,
        name: g.name || GOAL_TYPE_LABELS[g.type],
        type: g.type,
        targetToday: g.targetToday ?? 0,
        targetDate: g.noDeadline ? null : g.targetDate,
        priority: g.priority,
        inflationRate: g.inflationRate === "" ? null : Number(g.inflationRate),
        savedAmount: g.savedAmount ?? 0,
      });
      if (!res.ok) return setError(res.error);
      router.push(afterSave === "goal" ? `/goals/${res.id}` : afterSave);
      router.refresh();
    });
  }

  function remove() {
    if (!g.id || !confirm("Delete this goal? Its holding links are removed too.")) return;
    start(async () => {
      const res = await deleteGoal(g.id!);
      if (!res.ok) return setError(res.error);
      router.push("/goals");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Goal type" htmlFor="g-type">
          <Select id="g-type" value={g.type} onChange={(e) => set({ type: e.target.value as GoalType })}>
            {Object.entries(GOAL_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name" htmlFor="g-name">
          <Input
            id="g-name"
            value={g.name}
            maxLength={60}
            placeholder={GOAL_TYPE_LABELS[g.type]}
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>
        <Field
          label="Target in today's rupees"
          htmlFor="g-target"
          tip="What it would cost if you bought it today. We add inflation to find the future amount."
        >
          <MoneyInput id="g-target" required value={g.targetToday} onChange={(v) => set({ targetToday: v })} />
        </Field>
        <div className="space-y-2">
          {g.noDeadline ? (
            <Field label="Target date" htmlFor="g-nodate" hint="We'll estimate when you get there from your linked SIPs and savings.">
              <p id="g-nodate" className="flex h-10 items-center text-sm text-muted-foreground">
                No fixed date
              </p>
            </Field>
          ) : (
            <Field label="Target date" htmlFor="g-date">
              <Input
                id="g-date"
                type="date"
                required
                value={g.targetDate}
                onChange={(e) => set({ targetDate: e.target.value })}
              />
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={g.noDeadline}
              onChange={(e) => set({ noDeadline: e.target.checked })}
            />
            No fixed date: tell me when I&apos;ll get there
          </label>
        </div>
        <Field label="Priority" htmlFor="g-priority" hint="1 is most important. Higher priority goals get funded first.">
          <Select id="g-priority" value={g.priority} onChange={(e) => set({ priority: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Already saved for it" htmlFor="g-saved" hint="Money set aside that isn't a linked holding.">
          <MoneyInput id="g-saved" value={g.savedAmount} onChange={(v) => set({ savedAmount: v })} />
        </Field>
        <Field
          label="Inflation (% a year)"
          htmlFor="g-infl"
          tip="How fast the cost of this goal rises each year. Education and medical costs rise faster."
          hint={`Leave blank to use ${defaultInflation[g.type] ?? 6}% for this goal type.`}
        >
          <Input
            id="g-infl"
            inputMode="decimal"
            value={g.inflationRate}
            onChange={(e) => set({ inflationRate: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) })}
          />
        </Field>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push(cancelHref)} disabled={pending}>
            Cancel
          </Button>
          {g.id && (
            <Button type="button" variant="ghost" className="text-danger" onClick={remove} disabled={pending}>
              Delete goal
            </Button>
          )}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save goal"}
        </Button>
      </div>
    </form>
  );
}

export { GOAL_TYPE_LABELS };
