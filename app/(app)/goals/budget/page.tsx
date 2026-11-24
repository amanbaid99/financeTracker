import { todayIST } from "@/lib/dates";
import { loadSavedSipPlan } from "@/lib/hybrid-data";
import { SavedSipSummary } from "@/components/saved-sip-summary";
import type { HybridResult } from "@/lib/hybrid-engine";
import type { Metadata } from "next";
import { BudgetExperience } from "@/components/budget-experience";
import { loadBudgetSheet } from "@/lib/budget-ratio-data";
import { GuideButton } from "@/components/guides";
import { loadBudget } from "@/lib/data";

export const metadata: Metadata = { title: "Budget" };

/** The Budget tab: money in and out each month, and, between jobs, whether you're covered till salary. */
export default async function BudgetPage() {
  const sipRequest = loadSavedSipPlan().then(plan => ({plan,error:false})).catch(() => ({plan:null,error:true}));
  const { loanEmis, recordCosts, recordIncome, budget, sips } = await loadBudget();
  // A new budget starts at your recorded income; a saved one keeps its own.
  const sheet = await loadBudgetSheet(budget.income || recordIncome, loanEmis);
  const sip = await sipRequest;
  return (
    <main className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
          <GuideButton id="budget" />
        </div>
      </div>
      <BudgetExperience initial={sheet.plan} saved={sheet.saved} salary={recordIncome} loans={loanEmis} knownCosts={recordCosts} sips={sips} loadError={sheet.error} sipSummary={sip.plan ? <SavedSipSummary result={sip.plan.result as unknown as HybridResult} startMonth={(sip.plan.inputs as {contributionStartMonth?: string})?.contributionStartMonth} savedOn={todayIST(new Date(sip.plan.created_at))} today={todayIST()} /> : sip.error ? <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">Could not load your saved SIP plan. Reload to try again.</p> : null} />
    </main>
  );
}
