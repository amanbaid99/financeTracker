import {
  CalendarClock,
  ChevronRight,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BudgetRatioPlanner } from "@/components/budget-ratio-planner";
import { loadRatioPlan } from "@/lib/budget-ratio-data";
import { BudgetPlanner } from "@/components/budget-planner";
import { GuideButton } from "@/components/guides";
import { runwayHeadline } from "@/components/runway-card";
import { formatINR } from "@/lib/format";
import { loadBudget, loadRunway, loadGoals } from "@/lib/data";

export const metadata: Metadata = { title: "Budget" };

/** The Budget tab: money in and out each month, and, between jobs, whether you're covered till salary. */
export default async function BudgetPage() {
  const [{ incomes, costs, loanEmis, sips, plan, budget }, r, ratio, g] = await Promise.all([
    loadBudget(),
    loadRunway(),
    loadRatioPlan(),
    loadGoals(),
  ]);
  const head = r.active && r.runway ? runwayHeadline(r.runway) : null;
  const runwayRow = (
    <Link
      href="/goals/salary"
      data-guide="runway"
      className="surface-card press flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 hover:border-primary/40"
    >
      {head ? (
        head.tone === "good" ? (
          <ShieldCheck className="size-5 shrink-0 text-success" aria-hidden />
        ) : (
          <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden />
        )
      ) : (
        <CalendarClock className="size-5 shrink-0 text-primary" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {head ? head.text : "Between jobs?"}
        </span>
        <span className="block text-xs text-muted-foreground">
          {head && r.runway
            ? r.runway.worst.weekly > 0
              ? `Covered till salary · spend up to ${formatINR(r.runway.worst.weekly)} a week`
              : "Covered till salary · hold off on what can wait"
            : "Check your money lasts till your next salary."}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </Link>
  );
  return (
    <main className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
          <GuideButton id="budget" />
        </div>
        <p className="text-sm text-muted-foreground">
          Choose how your salary supports everyday life and your goals.
        </p>
      </div>
      {head && runwayRow}
      <BudgetRatioPlanner initial={ratio.plan} salary={budget.income} context={{ costs, loanEmis, sips, goals: g.goals, today: g.today }} loadError={ratio.error} />
      <details className="rounded-2xl border bg-card p-4">
      <summary className="cursor-pointer font-medium">Recorded income and commitments</summary>
      <p className="my-3 text-sm text-muted-foreground">These are the current amounts used by your goal and SIP plan. Update them here when they change.</p>
      <BudgetPlanner
        incomes={incomes}
        costs={costs}
        loanEmis={loanEmis}
        sips={sips}
        planMonthly={plan?.monthly ?? null}
        between={r.active}
      />
      </details>
      {/* Not between jobs: a quiet link at the end. */}
      {!head && runwayRow}
    </main>
  );
}
