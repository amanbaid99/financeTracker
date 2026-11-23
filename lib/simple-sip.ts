// The SIP plan as one list: every holding you could put monthly money into,
// with a suggested amount (₹0 where nothing is suggested), so you decide.
// Pure; suggestions only. Nothing is saved or bought.

import {
  hybridPlan,
  hybridVehicles,
  type HybridPlanInput,
} from "./hybrid-plan";
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
  riskTolerance?: HybridPlanInput["riskTolerance"];
}): {
  holdings: HoldingRow[];
  newFunds: NewFundRow[];
  goalsNeed: number;
  basis: number;
} {
  const base: HybridPlanInput = {
    today: opts.today,
    goals: opts.goals,
    investments: opts.investments,
    links: opts.links,
    riskTolerance: opts.riskTolerance,
    monthlySavings: 0,
  };
  let goalsNeed = 0;
  let vehicles: ReturnType<typeof hybridVehicles> = [];
  try {
    // What the goals need, then a split of that (or of the budget, if smaller).
    goalsNeed = hybridPlan({
      ...base,
      monthlySavings: 1e9,
    }).totalMonthlyRequired;
    const basis =
      opts.budgetMonthly > 0
        ? Math.min(opts.budgetMonthly, goalsNeed)
        : goalsNeed;
    const input = { ...base, monthlySavings: basis };
    vehicles = hybridVehicles(input, hybridPlan(input));
  } catch {
    vehicles = [];
  }
  const basis =
    opts.budgetMonthly > 0
      ? Math.min(opts.budgetMonthly, goalsNeed)
      : goalsNeed;
  const covers = (key: string) =>
    vehicles.find((v) => v.key === key)?.parts.map((p) => p.goalName) ?? [];
  const holdings = opts.investments
    .filter((i) => !NOT_MONTHLY.has(asKind(i.kind)))
    .map((i) => {
      const v = vehicles.find((x) => x.key === `inv:${i.id}`);
      return {
        investment: i,
        label:
          i.name?.trim() ||
          (i.kind === "mutual_fund"
            ? categoryLabel(i.category)
            : KIND_LABELS[asKind(i.kind)]),
        kindLabel:
          i.kind === "mutual_fund"
            ? categoryLabel(i.category)
            : KIND_LABELS[asKind(i.kind)],
        suggested: v?.total ?? 0,
        covers: covers(`inv:${i.id}`),
      };
    })
    .sort(
      (a, b) =>
        b.suggested - a.suggested ||
        b.investment.monthlySip - a.investment.monthlySip ||
        a.label.localeCompare(b.label),
    );
  const newFunds = vehicles
    .filter((v) => v.key.startsWith("new:") && v.total > 0)
    .map((v) => ({
      key: v.key,
      label: `A new ${categoryLabel(v.key.slice(4).split(":")[0]).toLowerCase()}`,
      category: v.key.slice(4).split(":")[0],
      suggested: v.total,
      covers: v.parts.map((p) => p.goalName),
    }));
  return { holdings, newFunds, goalsNeed, basis };
}
