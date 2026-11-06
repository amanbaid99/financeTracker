"use client";

import { useState } from "react";
import { GoalList } from "@/components/goal-list";
import { MoneyPlanCard } from "@/components/money-plan";
import { goalStatus } from "@/lib/goal-status";
import { formatINR, formatINRCompact } from "@/lib/format";
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
  const counts = (
    [
      ["danger", "need action", "bg-danger"],
      ["warning", "behind", "bg-warning"],
      ["success", "on track", "bg-success"],
      ["muted", "not started", "bg-muted-foreground/40"],
    ] as const
  )
    .map(([tone, label, bar]) => ({
      tone,
      label,
      bar,
      count: props.goals.filter((g) => goalStatus(g, props.today).tone === tone)
        .length,
    }))
    .filter((c) => c.count > 0);
  const total = counts.reduce((s, c) => s + c.count, 0);
  const saved = props.goals.reduce((s, g) => s + g.current, 0);
  const going = props.goals.reduce((s, g) => s + g.monthlySip, 0);
  return (
    <>
      <section
        aria-label="Your goals at a glance"
        className="surface-card space-y-3 rounded-2xl border bg-card p-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Saved for goals</p>
            <p className="tabular mt-0.5 text-2xl font-semibold tracking-tight">
              {formatINRCompact(saved)}
            </p>
          </div>
          <div className="border-l pl-3">
            <p className="text-xs text-muted-foreground">Going in a month</p>
            <p className="tabular mt-0.5 text-2xl font-semibold tracking-tight">
              {going > 0 ? formatINR(going) : "₹0"}
            </p>
          </div>
        </div>
        {total > 0 && (
          <div className="space-y-1.5">
            <div
              className="flex h-1.5 gap-0.5 overflow-hidden rounded-full"
              aria-hidden
            >
              {counts.map((c) => (
                <span
                  key={c.tone}
                  className={cn("h-full", c.bar)}
                  style={{ width: `${(c.count / total) * 100}%` }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {counts.map((c) => `${c.count} ${c.label}`).join(" · ")}
            </p>
          </div>
        )}
      </section>
      <MoneyPlanCard
        {...props}
        strategy={strategy}
        onStrategyChange={setStrategy}
      />
      <div id="your-goals" className="scroll-mt-20">
        <GoalList {...props} strategy={strategy} />
      </div>
    </>
  );
}
