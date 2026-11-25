import type { Metadata } from "next";
import { BudgetExperience } from "@/components/budget-experience";
import { GuideButton } from "@/components/guides";
import { loadBudgetSheet } from "@/lib/budget-ratio-data";
import { budgetEssentials, budgetSipAmount } from "@/lib/budget-sip-amount";
import { loadBudget, loadGoals } from "@/lib/data";
import { holdingLabel } from "@/lib/goal-suggestions";
import { loadHybridContext } from "@/lib/hybrid-data";
import { proposeGoalMapping } from "@/lib/hybrid-mapping";
import { suggestSipRows } from "@/lib/sip-suggest";

export const metadata: Metadata = { title: "Budget" };

/** The Budget tab: money in and out each month, and your SIPs. */
export default async function BudgetPage() {
  const [{ loanEmis, recordCosts, recordIncome, budget, sips }, g, c] =
    await Promise.all([
      loadBudget(),
      loadGoals(),
      loadHybridContext().catch(() => null),
    ]);
  // A new budget starts at your recorded income; a saved one keeps its own.
  const sheet = await loadBudgetSheet(budget.income || recordIncome, loanEmis);
  const active = g.goals.filter(
    (x) => x.status !== "reached" && !x.completed && !(x.loanState && x.emisCloseFirst),
  );
  let links = g.links;
  try {
    links = proposeGoalMapping(g.goals, g.investments, g.links, g.today, {
      riskTolerance: c?.riskTolerance,
    });
  } catch {
    links = g.links;
  }
  const suggestion = sheet.error
    ? []
    : suggestSipRows({
        goals: g.goals,
        investments: g.investments,
        links,
        today: g.today,
        budgetMonthly: budgetSipAmount(sheet.plan, sheet.saved),
        essentialsMonthly: budgetEssentials(sheet.plan, sheet.saved),
        riskTolerance: c?.riskTolerance,
      });
  return (
    <main className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
          <GuideButton id="budget" />
        </div>
      </div>
      <BudgetExperience
        initial={sheet.plan}
        saved={sheet.saved}
        salary={recordIncome}
        loans={loanEmis}
        knownCosts={recordCosts}
        sips={sips}
        loadError={sheet.error}
        holdings={g.investments
          .filter((i) => i.kind !== "fd" && i.kind !== "epf")
          .map((i) => ({ id: i.id, label: holdingLabel(i) }))}
        goals={active.map((x) => ({ id: x.id, label: x.name }))}
        sipSuggestion={suggestion}
      />
    </main>
  );
}
