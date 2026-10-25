import type { Metadata } from "next";
import { BudgetBuilder } from "@/components/budget-builder";
import { MUST_PAY } from "@/lib/labels";
import { Card, CardContent } from "@/components/ui/card";
import { loadAnalysis } from "@/lib/data";

export const metadata: Metadata = { title: "Build my budget" };

export default async function BuildBudgetPage() {
  const { raw, analysis } = await loadAnalysis();
  const { budget, config } = analysis;
  const regular = raw.incomes.filter((s) => s.active && s.type !== "bonus");
  const single = regular.length === 1 ? regular[0] : null;
  const costs: Record<string, number | null> = {};
  for (const c of MUST_PAY) {
    const row = raw.expenses.find((e) => e.category.toLowerCase() === c.toLowerCase());
    costs[c] = row ? row.amount_monthly : null;
  }
  // Expense lines added elsewhere that aren't one of the questions still count.
  const otherExpenses = raw.expenses
    .filter((e) => e.is_essential && !MUST_PAY.some((c) => c.toLowerCase() === e.category.toLowerCase()))
    .reduce((s, e) => s + e.amount_monthly, 0);

  return (
    <main className="mx-auto max-w-xl space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Build my budget</h1>
        <p className="text-sm text-muted-foreground">Four quick questions. You can change any answer later.</p>
      </div>
      <Card>
        <CardContent className="pt-5 sm:pt-5">
          <BudgetBuilder
            initial={{
              income: regular.length ? budget.expectedIncome : null,
              incomeStreamId: single?.id ?? null,
              multipleIncomes: regular.length > 1,
              costs,
              alreadyCounted:
                budget.essentials.emis + budget.essentials.insurancePremiums + budget.essentials.planned + otherExpenses,
              savingsPct: Math.round(config.budget.savingsMinPct * 100),
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
