import {
  CalendarClock,
  ChevronRight,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BudgetSheet } from "@/components/budget-sheet";
import { loadBudgetSheet } from "@/lib/budget-ratio-data";
import { GuideButton } from "@/components/guides";
import { runwayHeadline } from "@/components/runway-card";
import { formatINR } from "@/lib/format";
import { loadBudget, loadRunway, loadGoals } from "@/lib/data";

export const metadata: Metadata = { title: "Budget" };

/** The Budget tab: money in and out each month, and, between jobs, whether you're covered till salary. */
export default async function BudgetPage() {
  const [{ loanEmis, recordCosts, recordIncome, sips, budget, plan }, r, g] = await Promise.all([
    loadBudget(),
    loadRunway(),
    loadGoals(),
  ]);
  // A new budget starts at your recorded income; a saved one keeps its own.
  const sheet = await loadBudgetSheet(budget.income || recordIncome, loanEmis);
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
          Your monthly money, in one place.
        </p>
      </div>
      {head && runwayRow}
      <BudgetSheet initial={sheet.plan} saved={sheet.saved} salary={recordIncome} loans={loanEmis} knownCosts={recordCosts} recordedSips={sips} planMonthly={plan?.monthly ?? null} goals={g.goals.map((goal) => ({ type: goal.type, status: goal.status, isLoan: !!goal.loanState, isBillsFund: !!goal.billsFund, monthlySip: goal.monthlySip, extraSipNeeded: goal.extraSipNeeded }))} loadError={sheet.error} />
      {/* Not between jobs: a quiet link at the end. */}
      {!head && runwayRow}
    </main>
  );
}
