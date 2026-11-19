"use client";

import { useId } from "react";
import { formatINR } from "@/lib/format";
import { reviewBudget, type BudgetReviewGoal } from "@/lib/budget-insights";
import type { BudgetSheet } from "@/lib/budget-sheet";

const COLORS = {
  fixed: "bg-slate-500", variable: "bg-amber-500", investing: "bg-primary",
  savings: "bg-sky-500", debt: "bg-violet-500", personal: "bg-pink-500", remaining: "bg-muted-foreground/25",
};
export function BudgetAllocation({ plan, goals }: { plan: BudgetSheet; goals: BudgetReviewGoal[] }) {
  const review = reviewBudget(plan, goals);
  const headingId = useId();
  return <section aria-labelledby={headingId} className="space-y-4 rounded-2xl border bg-card p-4">
    <h3 id={headingId} className="text-sm font-semibold">Your allocation</h3>
    {review.slices.length > 0 && <>
      <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted">{review.slices.map((s) => <span key={s.key} className={`h-full ${COLORS[s.key]}`} style={{ width: `${s.width}%` }} />)}</div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{review.slices.map((s) => <div key={s.key} className="min-w-0">
        <dt className="flex items-start gap-1.5 text-xs text-muted-foreground"><span className={`mt-1 size-2 shrink-0 rounded-full ${COLORS[s.key]}`} aria-hidden /><span className="break-words">{s.label}</span></dt>
        <dd className="tabular ml-3.5 mt-0.5 break-words text-xs font-medium">{formatINR(s.amount)}{s.percent !== null && <span className="font-normal text-muted-foreground"> · {s.percent.toFixed(1).replace(/\.0$/, "")}%</span>}</dd>
      </div>)}</dl>
      {review.overBudget && <p className="text-[11px] text-muted-foreground">The bar shows the proportions of your plan. Percentages show shares of income.</p>}
    </>}
    <div className="space-y-3 border-t pt-3">
      <h4 className="text-xs font-medium text-muted-foreground">How this looks</h4>
      {review.insights.slice(0, 2).map((item) => <div key={item.title} className="text-sm"><p className={`font-medium ${item.tone === "good" ? "text-primary" : item.tone === "attention" ? "text-danger" : ""}`}>{item.title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.text}</p></div>)}
      {review.goalComparison && <p className="text-[11px] text-muted-foreground">Overall capacity, not money assigned to goals.</p>}
      {(review.insights.length > 2 || review.goalComparison) && <details className="text-xs"><summary className="cursor-pointer text-primary">More context</summary><div className="mt-2 space-y-2">
        {review.insights.length > 2 && <div><p className="font-medium">{review.insights[2].title}</p><p className="mt-0.5 leading-relaxed text-muted-foreground">{review.insights[2].text}</p></div>}
        {review.goalComparison && <p className="text-muted-foreground">Goal pace uses existing monthly SIPs plus the calculated extra needed for unfinished savings goals. Loan payoff goals are separate.{review.unmeasuredGoals > 0 ? ` ${review.unmeasuredGoals} goals without a monthly pace are left out.` : ""} Not investment advice.</p>}
      </div></details>}
    </div>
  </section>;
}
