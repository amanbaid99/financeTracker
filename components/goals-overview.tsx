"use client";

import { ArrowDownRight, CircleCheck, Compass } from "lucide-react";
import { groupGoals } from "@/lib/goal-summary";
import { useState } from "react";
import { GoalList } from "@/components/goal-list";
import { MoneyPlanCard } from "@/components/money-plan";
import type { MoneyPlan, Suggestion } from "@/lib/allocate";
import type { SipStrategy } from "@/lib/sip-plan";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";

/** Keep the displayed SIP strategy and the goal's confirmation form in sync. */
export function GoalsOverview(props: {
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
}) {
  const [strategy, setStrategy] = useState<SipStrategy>("diversified");
  const groups = groupGoals(props.goals);
  const count = groups.attention.length;
  const Icon = count ? Compass : CircleCheck;
  return <>
    <section aria-labelledby="next-step-h" className="flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3">
      <Icon className="size-4 shrink-0 text-primary" aria-hidden />
      <h2 id="next-step-h" className="min-w-0 flex-1 text-sm font-medium">
        {count ? `${count} ${count === 1 ? "goal needs" : "goals need"} attention` : groups.growing.length ? "No flagged goal shortfalls" : "Your goals at a glance"}
      </h2>
      {count > 0 && <a href="#your-goals" className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-medium text-primary" aria-label="Review goals needing attention">Review <ArrowDownRight className="size-4" aria-hidden /></a>}
    </section>
    <MoneyPlanCard {...props} strategy={strategy} onStrategyChange={setStrategy} />
    <div id="your-goals" className="scroll-mt-20">
      <GoalList {...props} strategy={strategy} />
    </div>
  </>;
}
