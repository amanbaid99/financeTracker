// The SIP plan as one list: every holding you could put monthly money into,
// with a suggested amount (₹0 where nothing is suggested), so you decide.
// Uses the same hybrid engine and vehicle picker as confirmation and goal outcomes.

import { hybridPlan, hybridVehicles } from "./hybrid-plan";
import { KIND_LABELS, asKind } from "./instruments";
import { categoryLabel } from "./categories";

import type { Investment, Link, TrackedGoal } from "./tracker";

/** Kinds you can't add monthly money to yourself. */
const NOT_MONTHLY = new Set(["fd", "epf"]);

export interface HoldingRow {
  investment: Investment;
  label: string;
  kindLabel: string;
  /** Suggested total a month, including any SIP already running. */
  suggested: number;
  covers: string[];
}

export interface NewFundRow {
  key: string;
  label: string;
  category: string;
  suggested: number;
  covers: string[];
}

export function sipSuggestions(opts: {
  goals: TrackedGoal[];
  investments: Investment[];
  links: Link[];
  today: string;
  /** Your budget's Save & invest a month, or 0 when it has none. */
  budgetMonthly: number;
  /** Fixed costs and EMIs a month, for the emergency fund floor. */
  essentialsMonthly?: number;
  riskTolerance?: "conservative" | "moderate" | "aggressive" | null;
}): {
  holdings: HoldingRow[];
  newFunds: NewFundRow[];
  goalsNeed: number;
  basis: number;
  inHoldings: number;
  inNewFunds: number;
  unplaced: number;
  /** Per goal: how much and why. */
  byGoal: { goalId: string; goalName: string; monthly: number; why: string }[];
} {
  const input = {
    goals: opts.goals, investments: opts.investments, links: opts.links,
    today: opts.today, riskTolerance: opts.riskTolerance,
    monthlySavings: Math.max(0, opts.budgetMonthly),
  };
  const plan = hybridPlan(input);
  const lines = hybridVehicles(input, plan);
  const byInvestment = new Map(lines.map(l => [l.key, l]));
  const holdings = opts.investments
    .filter((i) => !NOT_MONTHLY.has(asKind(i.kind)))
    .map((i) => {
      const line = byInvestment.get(`inv:${i.id}`);
      const kindLabel =
        i.kind === "mutual_fund" ? categoryLabel(i.category) : KIND_LABELS[asKind(i.kind)];
      return {
        investment: i,
        label: i.name?.trim() || kindLabel,
        kindLabel,
        suggested: line?.total ?? 0,
        covers: line?.parts.map((p) => p.goalName) ?? [],
      };
    })
    .sort(
      (a, b) =>
        b.suggested - a.suggested ||
        b.investment.monthlySip - a.investment.monthlySip ||
        a.label.localeCompare(b.label),
    );
  const newFunds = lines
    .filter((l) => !l.key.startsWith("inv:") && l.total > 0)
    .map((l) => ({
      key: l.key,
      label: l.label,
      category: plan.goals.find(g => l.parts.some(p => p.goalId === g.goalId))?.investmentCategory ?? "liquid_fund",
      suggested: l.total,
      covers: l.parts.map((p) => p.goalName),
    }));
  const inHoldings = holdings.reduce((a, h) => a + h.suggested, 0);
  const inNewFunds = newFunds.reduce((a, f) => a + f.suggested, 0);
  return {
    holdings,
    newFunds,
    goalsNeed: plan.totalMonthlyRequired,
    basis: plan.totalMonthlyAllocated,
    inHoldings,
    inNewFunds,
    unplaced: Math.max(0, plan.totalMonthlyAllocated - inHoldings - inNewFunds),
    byGoal: plan.goals.map(g => ({goalId:g.goalId, goalName:g.goalName, monthly:g.recommendedMonthly, why:g.explanation})),
  };
}
