// Safety stages use recorded accessible cash, never projected market growth.
import { rollForward } from "./bills-fund";
import { FinancialDecimal as D } from "./funding-math";
import type { GoalInput, Investment, Link } from "./tracker";
import type { HybridGoal } from "./hybrid-engine";
export function goalSipDeadline(goal: GoalInput, today: string): string {
  const bills = (goal.bills ?? [])
    .map((b) => rollForward(b.nextDue, b.everyMonths, today))
    .sort();
  return (
    bills[0] ?? goal.targetDate ?? goal.emergencyReserveDate ?? "9999-12-31"
  );
}
export function prepareSafetyStages(
  goals: GoalInput[],
  rows: HybridGoal[],
  investments: Investment[],
  links: Link[],
  monthlyEssentials: number,
  today: string,
) {
  const safety = rows
    .filter((r) => {
      const g = goals.find((g) => g.id === r.goalId)!;
      return (
        !g.completed &&
        (g.type === "emergency_fund" || (g.emergencyReserve ?? 0) > 0)
      );
    })
    .sort((a, b) => a.goalId.localeCompare(b.goalId));
  const stages = safety.map((row) => {
    const goal = goals.find((g) => g.id === row.goalId)!;
    const target =
      goal.type === "emergency_fund"
        ? row.targetCorpus
        : (goal.emergencyReserve ?? 0);
    const accessible = links
      .filter((l) => l.goalId === goal.id)
      .reduce((sum, l) => {
        const inv = investments.find((i) => i.id === l.investmentId)!;
        const liquid =
          inv.kind === "savings" ||
          ["liquid_fund", "overnight_fund", "savings_account"].includes(
            inv.category ?? "",
          );
        return liquid &&
          (!inv.availability || inv.availability === "available") &&
          (!inv.accessibleOn || inv.accessibleOn <= today)
          ? sum.plus(new D(inv.value).times(l.percent).div(100))
          : sum;
      }, new D(0))
      .toDecimalPlaces(0, D.ROUND_FLOOR)
      .toNumber();
    const coverage = Math.min(target, accessible + row.oneTimeAllocated);
    const gap = Math.max(0, Math.min(target, monthlyEssentials * 3) - coverage);
    // Never add contributions to an already funded goal or exceed its unfilled target.
    const cap =
      row.status === "fully_funded"
        ? 0
        : Math.max(
            0,
            row.targetCorpus - row.existingCoverage - row.oneTimeAllocated,
          );
    row.requiredMonthly = Math.max(row.requiredMonthly, Math.min(gap, cap));
    row.assumptions.runway = {
      monthlyEssentials,
      accessibleCorpus: coverage,
      oneMonthTarget: Math.min(target, monthlyEssentials),
      threeMonthTarget: Math.min(target, monthlyEssentials * 3),
    };
    row.explanation =
      "Build one month of emergency cover, then three months, before funding goals by deadline. This is an accelerated safety contribution, not an extra goal.";
    if (accessible < Math.min(row.existingCoverage, target))
      row.warnings.push(
        "Only accessible bank, liquid and overnight balances count as emergency runway. Review other linked holdings before relying on them in an emergency.",
      );
    return { row, target, coverage, cap };
  });
  return {
    stages,
    coverage: stages.reduce((s, x) => s + x.coverage, 0),
    target: stages.reduce((s, x) => s + x.target, 0),
  };
}
