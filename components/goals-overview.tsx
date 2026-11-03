"use client";

import { useState } from "react";
import { GoalList } from "@/components/goal-list";
import { MoneyPlanCard } from "@/components/money-plan";
import { goalStatus, type GoalStatus } from "@/lib/goal-status";
import type { Budget } from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { MoneyPlan, Suggestion } from "@/lib/allocate";
import type { SipStrategy } from "@/lib/sip-plan";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";

/** Keep the displayed SIP strategy and the goal's confirmation form in sync. */
export function GoalsOverview(props: {
  budget: Budget;
  suggestions: Suggestion[];
  goals: TrackedGoal[];
  investments: Investment[];
  links: Link[];
  today: string;
  initialOpen: string | null;
  plan: MoneyPlan | null;
  sipsNow: number;
  unassigned: number;
  autoOpen: boolean;
  budgetMonthly: number | null;
}) {
  const [strategy, setStrategy] = useState<SipStrategy>("diversified");
  const [filter, setFilter] = useState<GoalStatus["tone"] | null>(null);
  const filters = (
    [
      ["danger", "Needs action"],
      ["warning", "Behind"],
      ["success", "On track"],
      ["muted", "Not started"],
    ] as const
  ).map(([tone, label]) => ({
    tone,
    label,
    count: props.goals.filter((g) => goalStatus(g, props.today).tone === tone)
      .length,
  }));
  return (
    <>
      <MoneyPlanCard
        {...props}
        strategy={strategy}
        onStrategyChange={setStrategy}
      />
      <div id="your-goals" className="scroll-mt-20 space-y-4">
        <div
          className="flex gap-1.5 overflow-x-auto pb-1"
          role="group"
          aria-label="Filter goals by status"
        >
          {[
            { tone: null, label: "All goals", count: props.goals.length },
            ...filters.filter((f) => f.count > 0),
          ].map((f) => (
            <button
              key={f.tone ?? "all"}
              type="button"
              aria-pressed={filter === f.tone}
              onClick={() => setFilter(f.tone)}
              className={cn(
                "press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
                filter === f.tone
                  ? "border-primary/20 bg-primary-soft text-primary"
                  : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
              <span className="tabular opacity-75">{f.count}</span>
            </button>
          ))}
        </div>
        <GoalList {...props} filter={filter} strategy={strategy} />
      </div>
    </>
  );
}
