import { ArrowUpDown, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { PlanView } from "@/components/plan-view";
import { RoadmapView } from "@/components/roadmap-view";
import { buttonVariants } from "@/components/ui/button";
import { loadLoans, loadMoneyPlan, loadRunway } from "@/lib/data";
import { roadmap } from "@/lib/roadmap";

export const metadata: Metadata = { title: "Your plan" };

/** One page for the plan: the steps from today, then the monthly split. */
export default async function PlanPage() {
  const [d, loans, r] = await Promise.all([
    loadMoneyPlan(),
    loadLoans(),
    loadRunway(),
  ]);
  const covered = r.runway
    ? r.runway.worst.left >= 0
      ? true
      : r.runway.worst.leftWithOwed >= 0
        ? null
        : false
    : null;
  const map = roadmap({
    today: d.today,
    goals: d.goals,
    loans,
    salary:
      r.active && r.salaryBest && r.salaryWorst
        ? { best: r.salaryBest, worst: r.salaryWorst, covered }
        : null,
  });
  return (
    <main className="space-y-5">
      <BackLink fallback="/goals" label="Goals" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your plan</h1>
        <p className="text-sm text-muted-foreground">
          The steps from today, then how your monthly money is split. Green is
          on plan, grey waits for salary, amber needs you.
        </p>
      </div>

      <section aria-labelledby="steps-h" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="steps-h" className="text-lg font-semibold">
            Step by step
          </h2>
          <Link
            href="/goals/order"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowUpDown /> Edit order
          </Link>
        </div>
        <RoadmapView map={map} today={d.today} />
      </section>

      <section aria-labelledby="split-h" className="space-y-3">
        <h2 id="split-h" className="text-lg font-semibold">
          Where your money goes
        </h2>
        {d.plan ? (
          <PlanView
            plan={d.plan}
            budget={d.budget}
            goals={d.goals}
            investments={d.investments}
            links={d.links}
            sipsNow={d.sipsNow}
            unassigned={d.unassigned}
            budgetMonthly={d.budgetMonthly}
          />
        ) : (
          <div className="surface-card space-y-3 rounded-2xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              {r.active
                ? "No monthly split yet. That's fine while you're between jobs: make one once your salary starts."
                : "No monthly split yet. Tell the app what you can invest each month, and it splits it across your goals."}
            </p>
            <Link
              href="/goals?do=plan"
              className={buttonVariants({
                variant: r.active ? "outline" : "default",
              })}
            >
              <Sparkles /> Make a plan
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
