import type { Metadata } from "next";
import { BudgetExperience } from "@/components/budget-experience";
import { GuideButton } from "@/components/guides";
import { loadBudgetSheet } from "@/lib/budget-ratio-data";
import { loadBudget, loadGoals } from "@/lib/data";
import { orderGoals } from "@/lib/goal-order";
import { holdingLabel } from "@/lib/goal-suggestions";
import { assetClassOf } from "@/lib/portfolio";

export const metadata: Metadata = { title: "Budget" };

/** The Budget tab: money in and out each month, and your SIPs. */
export default async function BudgetPage() {
  const [{ loanEmis, recordCosts, recordIncome, budget, sips }, g] =
    await Promise.all([loadBudget(), loadGoals()]);
  // A new budget starts at your recorded income; a saved one keeps its own.
  const sheet = await loadBudgetSheet(budget.income || recordIncome, loanEmis);
  const active = orderGoals(g.goals, g.today).filter(
    (x) =>
      x.status !== "reached" &&
      !x.completed &&
      !(x.loanState && x.emisCloseFirst),
  );
  return (
    <main className="space-y-4">
      <BudgetExperience
        heading={<div className="space-y-1">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
          <GuideButton id="budget" />
        </div>
      </div>}
        initial={sheet.plan}
        saved={sheet.saved}
        salary={recordIncome}
        loans={loanEmis}
        knownCosts={recordCosts}
        sips={sips}
        loadError={sheet.error}
        goals={active.map((x) => ({
          id: x.id,
          label: x.name,
          // Funds covering the goal that can take monthly money.
          vehicles: x.lines
            .filter(
              (l) =>
                l.investment.kind !== "fd" &&
                l.investment.kind !== "epf" &&
                !l.investment.noNewMoney,
            )
            .map((l) => ({
              label: holdingLabel(l.investment),
              assetClass: assetClassOf(l.investment),
            })),
        }))}
      />
    </main>
  );
}
