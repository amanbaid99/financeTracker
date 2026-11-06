import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BudgetPlanner } from "@/components/budget-planner";
import { loadBudget } from "@/lib/data";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage() {
  const { incomes, costs, loanEmis, sips, plan } = await loadBudget();
  return (
    <main className="space-y-5">
      <Link
        href="/goals"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> Goals
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
        <p className="text-sm text-muted-foreground">
          What comes in, what&apos;s fixed, and what&apos;s free to invest each
          month. A plan, not a spend tracker.
        </p>
      </div>
      <BudgetPlanner
        incomes={incomes}
        costs={costs}
        loanEmis={loanEmis}
        sips={sips}
        planMonthly={plan?.monthly ?? null}
      />
    </main>
  );
}
