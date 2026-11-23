// The SIP plan as one list: every holding you could put monthly money into,
// with a suggested amount (₹0 where nothing is suggested), so you decide.
// Amounts per goal come from lib/step-allocation.ts (emergency floor, bills,
// a little for every goal, then closest first); sipPlan then puts each goal's
// amount into a holding you already have. Pure; suggestions only.

import { categoryForHorizon, type Suggestion } from "./allocate";
import { KIND_LABELS, asKind } from "./instruments";
import { categoryLabel } from "./categories";
import { sipPlan } from "./sip-plan";
import { stepAllocation, type StepLine } from "./step-allocation";
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
  byGoal: StepLine[];
} {
  const plan = stepAllocation({
    goals: opts.goals,
    essentialsMonthly: opts.essentialsMonthly ?? 0,
    budget: opts.budgetMonthly,
  });
  const suggestions: Suggestion[] = plan.lines
    .filter((l) => l.monthly > 0)
    .map((l) => {
      const g = opts.goals.find((x) => x.id === l.goalId)!;
      const { category, why } = categoryForHorizon(g.months, g.type);
      return {
        goalId: g.id,
        goalName: g.name,
        lump: 0,
        monthly: l.monthly,
        category,
        categoryLabel: categoryLabel(category),
        why,
        after: g,
        stage: "ranked" as const,
      };
    });
  const lines = sipPlan(suggestions, opts.investments, opts.links, "pooled", opts.goals);
  const byInvestment = new Map(
    lines.flatMap((l) => (l.investment ? [[l.investment.id, l] as const] : [])),
  );
  const holdings = opts.investments
    .filter((i) => !NOT_MONTHLY.has(asKind(i.kind)))
    .map((i) => {
      const line = byInvestment.get(i.id);
      const kindLabel =
        i.kind === "mutual_fund" ? categoryLabel(i.category) : KIND_LABELS[asKind(i.kind)];
      return {
        investment: i,
        label: i.name?.trim() || kindLabel,
        kindLabel,
        suggested: line?.monthly ?? 0,
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
    .filter((l) => !l.investment && l.monthly > 0)
    .map((l) => ({
      key: l.key ?? `new:${l.category}`,
      label: `A new ${categoryLabel(l.category).toLowerCase()}`,
      category: l.category,
      suggested: l.monthly,
      covers: l.parts.map((p) => p.goalName),
    }));
  const inHoldings = holdings.reduce((a, h) => a + h.suggested, 0);
  const inNewFunds = newFunds.reduce((a, f) => a + f.suggested, 0);
  return {
    holdings,
    newFunds,
    goalsNeed: plan.need,
    basis: plan.basis,
    inHoldings,
    inNewFunds,
    unplaced: Math.max(0, plan.basis - inHoldings - inNewFunds),
    byGoal: plan.lines,
  };
}
