// Splits money the user can invest across their goals: savings available now
// and a monthly amount. Suggestions only; nothing is saved until the user acts.

import { categoryLabel } from "./categories";
import { sortGoals } from "./goal-summary";
import { RETURN_BY_CATEGORY } from "./instruments";
import {
  projectedValue,
  requiredSip,
  trackGoal,
  type Investment,
  type Link,
  type TrackedGoal,
} from "./tracker";

export interface Suggestion {
  goalId: string;
  goalName: string;
  /** Put this much in now. */
  lump: number;
  /** And this much each month. */
  monthly: number;
  /** Fund category that suits the goal's timeline. */
  category: string;
  categoryLabel: string;
  /** Why this kind of fund, in a few words. */
  why: string;
  /** The goal as it would look with this suggestion. */
  after: TrackedGoal;
}

export interface MoneyPlan {
  lump: number;
  monthlyTotal: number;
  /** SIPs already running across all investments. */
  sipsNow: number;
  /** Monthly money not yet going anywhere. */
  monthlyFree: number;
  suggestions: Suggestion[];
  leftoverLump: number;
  leftoverMonthly: number;
  /** Extra a month still needed for dated goals after the plan. */
  stillShortMonthly: number;
}

/** Where to keep money for a goal, by how far away it is. */
export function categoryForHorizon(
  months: number | null,
  type: string,
): { category: string; why: string } {
  if (type === "emergency_fund")
    return { category: "liquid_fund", why: "safe and quick to withdraw" };
  if (type === "bills_fund")
    return { category: "liquid_fund", why: "payments due within a year" };
  if (months !== null && months < 12)
    return {
      category: "liquid_fund",
      why: "under a year away, so keep it safe",
    };
  if (months !== null && months < 36)
    return {
      category: "short_debt_fund",
      why: "1 to 3 years away, so low risk",
    };
  if (months !== null && months < 60)
    return {
      category: "balanced_advantage",
      why: "3 to 5 years away, so some equity",
    };
  return {
    category: "equity_index",
    why: "5+ years away, so equity can grow it",
  };
}

const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;

export function planMoney(opts: {
  goals: TrackedGoal[];
  investments: Investment[];
  links: Link[];
  lump: number;
  monthlyTotal: number;
  todayISO: string;
}): MoneyPlan {
  const { goals, investments, links, todayISO } = opts;
  const sipsNow = investments.reduce((s, i) => s + i.monthlySip, 0);
  const monthlyFree = Math.max(0, opts.monthlyTotal - sipsNow);
  let lumpLeft = Math.max(0, opts.lump);
  let monthlyLeft = monthlyFree;

  const active = sortGoals(goals).filter(
    (g) =>
      g.status !== "reached" && g.status !== "overdue" && !g.emisCloseFirst,
  );
  const alloc = new Map<
    string,
    {
      lump: number;
      monthly: number;
      category: string;
      why: string;
      rate: number;
    }
  >();
  const horizon = (g: TrackedGoal) => g.months ?? g.monthsToReach;
  for (const g of active) {
    const { category, why } = categoryForHorizon(horizon(g), g.type);
    alloc.set(g.id, {
      lump: 0,
      monthly: 0,
      category,
      why,
      rate: RETURN_BY_CATEGORY[category],
    });
  }

  // 0. Bills funds first: their payments are the nearest. Enough to cover
  // every payment in the next year.
  for (const g of active.filter((x) => x.billsFund)) {
    const a = alloc.get(g.id)!;
    const b = g.billsFund!;
    a.lump = Math.min(lumpLeft, roundUp(b.topUpNow, 1000));
    lumpLeft -= a.lump;
    a.monthly = Math.min(
      monthlyLeft,
      roundUp(Math.max(0, b.monthlyNeed - g.monthlySip), 500),
    );
    monthlyLeft -= a.monthly;
  }

  // 1. Dated goals, soonest first: enough to be on time.
  for (const g of active.filter((x) => x.targetDate && x.months)) {
    const a = alloc.get(g.id)!;
    const m = g.months!;
    const shortfall =
      g.futureTarget - projectedValue(g.current, g.monthlySip, g.returnPct, m);
    if (shortfall <= 0) continue;
    const growth = projectedValue(1, 0, a.rate, m);
    a.lump = Math.min(lumpLeft, roundUp(shortfall / growth, 1000));
    lumpLeft -= a.lump;
    const rest = shortfall - a.lump * growth;
    if (rest > 0) {
      a.monthly = Math.min(
        monthlyLeft,
        roundUp(requiredSip(rest, 0, a.rate, m), 500),
      );
      monthlyLeft -= a.monthly;
    }
  }

  // 2. Whatever is left goes to goals with no date, by how much each still needs.
  const open = active.filter((g) => !g.targetDate && !g.billsFund);
  const gaps = open.map((g) => Math.max(0, g.futureTarget - g.current));
  const totalGap = gaps.reduce((s, x) => s + x, 0);
  if (totalGap > 0 && (lumpLeft > 0 || monthlyLeft > 0)) {
    let lumpGiven = 0;
    let monthlyGiven = 0;
    open.forEach((g, i) => {
      const a = alloc.get(g.id)!;
      const share = gaps[i] / totalGap;
      a.lump = Math.min(gaps[i], Math.floor((lumpLeft * share) / 1000) * 1000);
      a.monthly = Math.floor((monthlyLeft * share) / 500) * 500;
      lumpGiven += a.lump;
      monthlyGiven += a.monthly;
    });
    lumpLeft -= lumpGiven;
    monthlyLeft -= monthlyGiven;
  }

  // Show each goal as it would look with its suggestion.
  const suggestions: Suggestion[] = [];
  for (const g of active) {
    const a = alloc.get(g.id)!;
    if (!a.lump && !a.monthly) continue;
    const virtual: Investment = {
      id: `plan-${g.id}`,
      kind: "mutual_fund",
      name: null,
      category: a.category,
      value: a.lump,
      monthlySip: a.monthly,
      returnPct: a.rate,
    };
    const after = trackGoal(
      g,
      [...investments, virtual],
      [...links, { goalId: g.id, investmentId: virtual.id, percent: 100 }],
      todayISO,
    );
    suggestions.push({
      goalId: g.id,
      goalName: g.name,
      lump: a.lump,
      monthly: a.monthly,
      category: a.category,
      categoryLabel: categoryLabel(a.category),
      why: a.why,
      after,
    });
  }

  const stillShortMonthly = active
    .filter((g) => g.targetDate || g.billsFund)
    .reduce(
      (s, g) =>
        s +
        (suggestions.find((x) => x.goalId === g.id)?.after.extraSipNeeded ??
          g.extraSipNeeded),
      0,
    );

  return {
    lump: opts.lump,
    monthlyTotal: opts.monthlyTotal,
    sipsNow,
    monthlyFree,
    suggestions,
    leftoverLump: Math.max(0, lumpLeft),
    leftoverMonthly: Math.max(0, monthlyLeft),
    stillShortMonthly,
  };
}
