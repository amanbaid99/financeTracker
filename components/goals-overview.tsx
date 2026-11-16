"use client";

import { useState } from "react";
import { GoalList } from "@/components/goal-list";
import { MoneyPlanCard } from "@/components/money-plan";
import { ExtraMoney } from "@/components/extra-money";
import type { Budget } from "@/lib/budget";
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
  autoExtra?: boolean;
  budgetMonthly: number | null;
  /** Between jobs: savings goals wait for the salary. */
  between?: boolean;
}) {
  const [strategy, setStrategy] = useState<SipStrategy>("diversified");
  return (
    <>
      <ExtraMoney
        goals={props.goals}
        investments={props.investments}
        links={props.links}
        today={props.today}
        plan={props.plan}
        sipsNow={props.sipsNow}
        autoOpen={props.autoExtra}
      />
      <MoneyPlanCard
        {...props}
        strategy={strategy}
        onStrategyChange={setStrategy}
      />
      <div id="your-goals" data-guide="goal-list" className="scroll-mt-20">
        <GoalList {...props} strategy={strategy} />
      </div>
    </>
  );
}
