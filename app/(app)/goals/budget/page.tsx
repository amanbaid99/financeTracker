import { CalendarClock, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BudgetPlanner } from "@/components/budget-planner";
import { GuideButton } from "@/components/guides";
import { RunwayCard } from "@/components/runway-card";
import { loadBudget, loadRunway } from "@/lib/data";

export const metadata: Metadata = { title: "Budget" };

/** The Budget tab: money in and out each month, and, between jobs, whether you're covered till salary. */
export default async function BudgetPage() {
  const [{ incomes, costs, loanEmis, sips, plan }, r] = await Promise.all([
    loadBudget(),
    loadRunway(),
  ]);
  return (
    <main className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
          <GuideButton id="budget" />
        </div>
        <p className="text-sm text-muted-foreground">
          What comes in, what&apos;s fixed, and what&apos;s free to invest each
          month. A plan, not a spend tracker.
        </p>
      </div>
      {r.active && r.runway ? (
        <RunwayCard view={{ runway: r.runway }} />
      ) : (
        <Link
          href="/goals/salary"
          data-guide="runway"
          className="surface-card press flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 hover:border-primary/40"
        >
          <CalendarClock className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Between jobs?</span>
            <span className="block text-xs text-muted-foreground">
              Check your money lasts till your next salary.
            </span>
          </span>
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </Link>
      )}
      <BudgetPlanner
        incomes={incomes}
        costs={costs}
        loanEmis={loanEmis}
        sips={sips}
        planMonthly={plan?.monthly ?? null}
        between={r.active}
      />
    </main>
  );
}
