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
    <section aria-labelledby="next-step-h" className="relative overflow-hidden rounded-3xl border border-primary/15 bg-primary-soft p-5">
      <div className="pointer-events-none absolute -right-5 -top-8 size-32 rounded-full border border-primary/10" aria-hidden />
      <div className="pointer-events-none absolute -right-1 -top-4 size-24 rounded-full border border-primary/10" aria-hidden />
      <div className="relative space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
          <Icon className="size-4" aria-hidden /> Your next step
        </div>
        <h2 id="next-step-h" className="max-w-[24ch] text-xl font-semibold leading-snug tracking-tight">
          {count ? `${count} ${count === 1 ? "goal needs" : "goals need"} a little attention` : "Room to look ahead"}
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {count ? "Some goals need a top-up, a first investment or a new date. Take them one at a time." : groups.growing.length ? "Your active goals have no flagged shortfall. Keep values up to date and review your plan as life changes." : "Review your progress or make space for your next goal."}
        </p>
        {count > 0 && <a href="#your-goals" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary">See what needs attention <ArrowDownRight className="size-4" aria-hidden /></a>}
      </div>
    </section>
    <MoneyPlanCard {...props} strategy={strategy} onStrategyChange={setStrategy} />
    <div id="your-goals" className="scroll-mt-20">
      <GoalList {...props} strategy={strategy} />
    </div>
  </>;
}
