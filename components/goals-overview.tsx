"use client";

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
  budgetMonthly: number | null;
}) {
  const [strategy, setStrategy] = useState<SipStrategy>("diversified");
  return (
    <>
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
