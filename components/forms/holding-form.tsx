"use client";

import { ChevronDown, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { deleteHolding, saveHolding } from "@/lib/actions";
import { categoryLabel, defaultCategoryForKind, HOLDING_CATEGORIES } from "@/lib/engine/categories";
import { addMonths, todayIST } from "@/lib/engine/dates";
import type { GoalType, HoldingKind } from "@/lib/engine/types";
import { formatINR } from "@/lib/format";
import { GOAL_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Field } from "./field";

const KINDS: { kind: HoldingKind; label: string }[] = [
  { kind: "savings", label: "Bank / cash" },
  { kind: "fd", label: "FD / RD" },
  { kind: "mutual_fund", label: "Mutual fund" },
  { kind: "stock", label: "Stocks" },
  { kind: "ppf", label: "PPF" },
  { kind: "epf", label: "EPF / VPF" },
  { kind: "nps", label: "NPS" },
  { kind: "gold", label: "Gold" },
  { kind: "other", label: "Other" },
];

export interface HoldingFormValues {
  id?: string;
  kind: HoldingKind;
  name: string;
  category: string;
  currentValue: number | null;
  monthlySip: number | null;
  sipStepUpPct: string;
  expectedReturn: string;
  /** "none", a goal id, or "split" when spread across goals. */
  goal: string;
}

export function HoldingForm({
  initial,
  goals,
  defaultReturns,
}: {
  initial: HoldingFormValues;
  goals: { id: string; name: string }[];
  defaultReturns: Record<string, number>;
}) {
  const router = useRouter();
  const [h, setH] = useState(initial);
  const [more, setMore] = useState(false);
  const [newGoal, setNewGoal] = useState({
    name: "",
    type: "custom" as GoalType,
    targetToday: null as number | null,
    targetDate: addMonths(todayIST(), 36),
    noDeadline: false,
  });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = (patch: Partial<HoldingFormValues>) => setH((x) => ({ ...x, ...patch }));
  const def = defaultReturns[h.category] ?? defaultReturns.other ?? 7;
  const isNew = !h.id;
  const categories = HOLDING_CATEGORIES;
  const NOT_FUNDS = new Set(["savings_account", "sweep_fd", "fd_rd", "direct_equity", "ppf", "epf_vpf", "nps", "gold"]);
  const fundCategories = HOLDING_CATEGORIES.filter((c) => !NOT_FUNDS.has(c.value));

  function goalLink() {
    if (h.goal === "new") {
      return {
        mode: "new" as const,
        name: newGoal.name || GOAL_TYPE_LABELS[newGoal.type],
        type: newGoal.type,
        targetToday: newGoal.targetToday ?? 0,
        targetDate: newGoal.noDeadline ? null : newGoal.targetDate,
      };
    }
    if (h.goal === initial.goal || h.goal === "split") return undefined;
    if (h.goal === "none") return { mode: "none" as const };
    return { mode: "existing" as const, goalId: h.goal };
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (h.kind === "mutual_fund" && !h.category) return setError("Choose the fund's category.");
    start(async () => {
      const ret = h.expectedReturn === "" ? null : Number(h.expectedReturn);
      const res = await saveHolding({
        id: h.id ?? null,
        kind: h.kind,
        name: h.name.trim() || null,
        category: h.category || null,
        currentValue: h.currentValue ?? 0,
        monthlySip: h.monthlySip,
        sipStepUpPct: h.sipStepUpPct === "" ? null : Number(h.sipStepUpPct),
        expectedReturnPct: ret === null || ret === def ? null : ret,
        goalLink: goalLink(),
      });
      if (!res.ok) return setError(res.error);
      router.push("/holdings");
      router.refresh();
    });
  }

  function remove() {
    if (!h.id || !confirm("Remove this holding? Its goal links are removed too.")) return;
    start(async () => {
      const res = await deleteHolding(h.id!);
      if (!res.ok) return setError(res.error);
      router.push("/holdings");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What is it?</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              aria-pressed={h.kind === k.kind}
              onClick={() =>
                set({ kind: k.kind, category: k.kind === "mutual_fund" ? "" : defaultCategoryForKind(k.kind) })
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm",
                h.kind === k.kind ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="hf-name" hint="Anything you'll recognise. No account numbers." className="sm:col-span-2">
          <Input
            id="hf-name"
            maxLength={80}
            placeholder={h.kind === "savings" ? "e.g. Salary account" : h.kind === "mutual_fund" ? "e.g. My index fund" : ""}
            value={h.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>
        {h.kind === "mutual_fund" && (
          <Field
            label="Fund category"
            htmlFor="hf-fundcat"
            className="sm:col-span-2"
            hint="It's on your statement or the fund's page. It sets the expected return and whether it counts as emergency money."
          >
            <Select id="hf-fundcat" required value={h.category} onChange={(e) => set({ category: e.target.value })}>
              <option value="" disabled>
                Choose a category…
              </option>
              {fundCategories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Current value" htmlFor="hf-value">
          <MoneyInput id="hf-value" required value={h.currentValue} onChange={(v) => set({ currentValue: v })} />
        </Field>
        <Field label="Monthly SIP / deposit" htmlFor="hf-sip" hint="Leave blank if none.">
          <MoneyInput id="hf-sip" value={h.monthlySip} onChange={(v) => set({ monthlySip: v })} />
        </Field>
        <Field label="What's it for?" htmlFor="hf-goal" className="sm:col-span-2">
          {h.goal === "split" ? (
            <p className="text-sm text-muted-foreground">Split across several goals. Change the split below.</p>
          ) : (
            <Select id="hf-goal" value={h.goal} onChange={(e) => set({ goal: e.target.value })}>
              <option value="none">Nothing specific yet</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value="new">+ A new goal…</option>
            </Select>
          )}
        </Field>
      </div>

      {h.goal === "new" && (
        <div className="grid gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-2">
          <Field label="Goal name" htmlFor="hf-gname">
            <Input
              id="hf-gname"
              maxLength={60}
              placeholder={GOAL_TYPE_LABELS[newGoal.type]}
              value={newGoal.name}
              onChange={(e) => setNewGoal((g) => ({ ...g, name: e.target.value }))}
            />
          </Field>
          <Field label="Goal type" htmlFor="hf-gtype">
            <Select
              id="hf-gtype"
              value={newGoal.type}
              onChange={(e) => setNewGoal((g) => ({ ...g, type: e.target.value as GoalType }))}
            >
              {Object.entries(GOAL_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target amount (today's ₹)" htmlFor="hf-gtarget">
            <MoneyInput
              id="hf-gtarget"
              value={newGoal.targetToday}
              onChange={(v) => setNewGoal((g) => ({ ...g, targetToday: v }))}
            />
          </Field>
          <div className="space-y-2">
            {!newGoal.noDeadline && (
              <Field label="Target date" htmlFor="hf-gdate">
                <Input
                  id="hf-gdate"
                  type="date"
                  value={newGoal.targetDate}
                  onChange={(e) => setNewGoal((g) => ({ ...g, targetDate: e.target.value }))}
                />
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={newGoal.noDeadline}
                onChange={(e) => setNewGoal((g) => ({ ...g, noDeadline: e.target.checked }))}
              />
              No fixed date
            </label>
          </div>
        </div>
      )}

      <div className="rounded-xl border">
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        >
          <span>
            More options
            <span className="ml-2 font-normal text-muted-foreground">
              {categoryLabel(h.category)} · {h.expectedReturn || def}% a year
              {h.sipStepUpPct ? ` · SIP +${h.sipStepUpPct}%/yr` : ""}
            </span>
          </span>
          <ChevronDown className={cn("size-4 transition-transform", more && "rotate-180")} aria-hidden />
        </button>
        {more && (
          <div className="grid gap-4 border-t p-4 sm:grid-cols-2">
            <Field
              label="Category"
              htmlFor="hf-cat"
              tip="Savings, FDs and liquid funds count toward your emergency fund."
            >
              <Select id="hf-cat" value={h.category} onChange={(e) => set({ category: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Expected return (% a year)"
              htmlFor="hf-ret"
              hint={h.expectedReturn === "" ? `Typical for this category. Change it if you like.` : undefined}
              tip="A planning assumption used to project growth toward goals. Not live market data or a promise."
            >
              <Input
                id="hf-ret"
                inputMode="decimal"
                value={h.expectedReturn === "" ? String(def) : h.expectedReturn}
                onChange={(e) => set({ expectedReturn: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) })}
              />
            </Field>
            {(h.monthlySip ?? 0) > 0 && (
              <Field
                label="Yearly SIP step-up (%)"
                htmlFor="hf-step"
                tip="Raises the SIP by this percentage every year, e.g. with your pay rise."
                hint={
                  h.sipStepUpPct && Number(h.sipStepUpPct) > 0
                    ? `Next year: ${formatINR(Math.round((h.monthlySip ?? 0) * (1 + Number(h.sipStepUpPct) / 100)))}/month`
                    : "Leave blank if it stays the same."
                }
              >
                <Input
                  id="hf-step"
                  inputMode="decimal"
                  placeholder="e.g. 10"
                  value={h.sipStepUpPct}
                  onChange={(e) => set({ sipStepUpPct: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) })}
                />
              </Field>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push("/holdings")} disabled={pending}>
            Cancel
          </Button>
          {!isNew && (
            <Button type="button" variant="ghost" className="text-danger" onClick={remove} disabled={pending}>
              <Trash2 /> Remove holding
            </Button>
          )}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isNew ? "Add holding" : "Save"}
        </Button>
      </div>
    </form>
  );
}
