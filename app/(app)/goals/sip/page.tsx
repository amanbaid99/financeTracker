import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { SimpleSipPlanner } from "@/components/simple-sip-planner";
import { loadMoneyPlan, loadBudget } from "@/lib/data";
import { loadHybridContext } from "@/lib/hybrid-data";

export const metadata: Metadata = { title: "Your monthly SIPs" };
export default async function BudgetSipPage() {
  const [d, b, c] = await Promise.all([
    loadMoneyPlan(),
    loadBudget(),
    loadHybridContext(),
  ]);
  const prior = c.plans[0]?.inputs as
    | {
        budgetSource?: string;
        monthlySavings?: number;
        allocationMode?: "safety_deadline";
        monthlyEssentials?: number;
        monthlyPlanLimit?: number;
        overrides?: Record<string, number>;
      }
    | undefined;
  const initialMonthly = b.budgetConfigured
    ? Math.max(0, b.budget.planMonthly)
    : prior?.budgetSource === "manual"
      ? (prior.monthlySavings ?? null)
      : (d.planInput?.monthly ?? 0) > 0
        ? d.planInput!.monthly
        : b.budget.planMonthly > 0
          ? b.budget.planMonthly
          : null;
  return (
    <main className="space-y-4">
      <BackLink fallback="/goals" label="Goals" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Your monthly SIPs</h1>
        <p className="text-sm text-muted-foreground">
          Emergency cover first, then your nearest goals. Review the monthly
          amounts and save once.
        </p>
      </div>
      <SimpleSipPlanner
        goals={d.goals}
        investments={d.investments}
        links={d.links}
        today={d.today}
        budgetMonthly={Math.max(0, b.budget.planMonthly)}
        budgetConfigured={b.budgetConfigured}
        initialMonthly={
          prior?.allocationMode === "safety_deadline"
            ? (prior.monthlyPlanLimit ?? initialMonthly)
            : initialMonthly
        }
        monthlyEssentials={
          b.budgetConfigured
            ? b.budget.costs + b.budget.emis
            : (prior?.monthlyEssentials ?? null)
        }
        initialOverrides={
          prior?.allocationMode === "safety_deadline"
            ? (prior.overrides ?? {})
            : {}
        }
        revision={c.revision}
        riskTolerance={c.riskTolerance}
      />
    </main>
  );
}
