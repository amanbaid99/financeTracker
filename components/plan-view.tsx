"use client";

import NextLink from "next/link";
import { useState } from "react";
import { MoneyPlanCard } from "@/components/money-plan";
import type { MoneyPlan } from "@/lib/allocate";
import type { Budget } from "@/lib/budget";
import { formatINR } from "@/lib/format";
import type { SipStrategy } from "@/lib/sip-plan";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";
import { cn } from "@/lib/utils";

export function PlanView(props: {
  plan: MoneyPlan;
  budget: Budget;
  goals: TrackedGoal[];
  investments: Investment[];
  links: Link[];
  sipsNow: number;
  unassigned: number;
  budgetMonthly: number | null;
}) {
  const { plan } = props;
  const [strategy, setStrategy] = useState<SipStrategy>("pooled");
  const newMonthly = plan.suggestions.reduce((sum,s)=>sum+s.monthly,0);
  const lumpTotal = plan.suggestions.reduce((t, s) => t + s.lump, 0);

  return (
    <div className="space-y-5">
      <section
        aria-label="Plan summary"
        className="surface-card space-y-4 rounded-2xl border bg-card p-4"
      >
        <div>
          <p className="text-xs text-muted-foreground">Investing each month</p>
          <p className="tabular text-3xl font-semibold tracking-tight">
            {formatINR(plan.monthlyTotal)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>
              {formatINR(plan.sipsNow)} already going in
              {newMonthly > 0 && ` · ${formatINR(newMonthly)} new`}
            </span>
            {lumpTotal > 0 && <span>plus {formatINR(lumpTotal)} once</span>}

          </p>
        </div>
        <p
          className={cn(
            "rounded-lg p-2.5 text-sm",
            plan.stillShortMonthly > 0
              ? "bg-warning-soft text-warning"
              : "bg-success-soft text-success",
          )}
        >
          {plan.stillShortMonthly > 0
            ? `Your dated goals still need ${formatINR(plan.stillShortMonthly)} a month more to be on time.`
            : props.goals.some(g=>!!g.targetDate) ? "Every dated goal is on time with this plan." : "Your monthly allocation is ready to review."}
          {plan.leftoverMonthly > 0 &&
            ` ${formatINR(plan.leftoverMonthly)} a month is left over.`}
        </p>
      </section>

      <MoneyPlanCard {...props} variant="full" concise strategy={strategy} onStrategyChange={setStrategy} />
      <NextLink href="/assets/withdraw" className="inline-flex min-h-11 items-center text-sm font-medium text-primary">Plan a withdrawal</NextLink>
    </div>
  );
}
