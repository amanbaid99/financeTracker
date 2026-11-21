import type { Metadata } from "next";
import { BudgetExperience } from "@/components/budget-experience";
import { loadBudgetSheet } from "@/lib/budget-ratio-data";
import { GuideButton } from "@/components/guides";
import { loadBudget } from "@/lib/data";

export const metadata: Metadata = { title: "Budget" };

/** The Budget tab: money in and out each month, and, between jobs, whether you're covered till salary. */
export default async function BudgetPage() {
  const { loanEmis, recordCosts, recordIncome, budget } = await loadBudget();
  // A new budget starts at your recorded income; a saved one keeps its own.
  const sheet = await loadBudgetSheet(budget.income || recordIncome, loanEmis);
  return (
    <main className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
          <GuideButton id="budget" />
        </div>
      </div>
      <BudgetExperience initial={sheet.plan} saved={sheet.saved} salary={recordIncome} loans={loanEmis} knownCosts={recordCosts} loadError={sheet.error} />
    </main>
  );
}
