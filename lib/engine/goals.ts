import { defaultCategoryForKind, isEquity } from "./categories";
import type { EngineConfig, HorizonBand } from "./config";
import { monthsBetween } from "./dates";
import type { Goal, GoalAllocation, Holding, RiskProfile } from "./types";

/** FV = PV * (1 + i)^n, with i as a percentage per year. */
export function futureValue(presentValue: number, inflationPct: number, years: number): number {
  return presentValue * Math.pow(1 + inflationPct / 100, Math.max(0, years));
}

/**
 * Monthly SIP needed (paid at the start of each month) to reach `target` in
 * `months`, given current savings `saved` growing at the same return.
 * Negative means already funded. With 0 months the whole gap is due now.
 */
export function requiredSip(
  target: number,
  saved: number,
  annualReturnPct: number,
  months: number,
): number {
  const r = annualReturnPct / 100 / 12;
  if (months <= 0) return target - saved;
  const growth = Math.pow(1 + r, months);
  const gap = target - saved * growth;
  if (r === 0) return gap / months;
  return (gap * r) / ((growth - 1) * (1 + r));
}

/** Value at the end of `months` with savings S and a monthly SIP at the start of each month. */
export function projectedValue(
  saved: number,
  monthlySip: number,
  annualReturnPct: number,
  months: number,
): number {
  const r = annualReturnPct / 100 / 12;
  if (months <= 0) return saved;
  const growth = Math.pow(1 + r, months);
  if (r === 0) return saved + monthlySip * months;
  return saved * growth + (monthlySip * (growth - 1) * (1 + r)) / r;
}

/**
 * Value after `months` of a SIP paid at the start of each month that rises by
 * `stepUpPct` every 12 months. With no step-up this matches projectedValue.
 */
export function stepUpSipValue(
  monthlySip: number,
  stepUpPct: number,
  annualReturnPct: number,
  months: number,
): number {
  if (months <= 0 || monthlySip <= 0) return 0;
  const r = annualReturnPct / 100 / 12;
  const g = stepUpPct / 100;
  let total = 0;
  for (let k = 0; k < months; k++) {
    const sip = monthlySip * Math.pow(1 + g, Math.floor(k / 12));
    total += sip * Math.pow(1 + r, months - k);
  }
  return total;
}

/** Starting SIP needed if it steps up by `stepUpPct` a year. Negative means funded. */
export function requiredStepUpSip(
  target: number,
  saved: number,
  annualReturnPct: number,
  months: number,
  stepUpPct: number,
): number {
  if (months <= 0) return target - saved;
  const r = annualReturnPct / 100 / 12;
  const gap = target - saved * Math.pow(1 + r, months);
  return gap / stepUpSipValue(1, stepUpPct, annualReturnPct, months);
}

/** The return a holding plans with: the user's own figure, else its category default. */
export function expectedReturnFor(
  holding: Pick<Holding, "kind" | "category" | "expectedReturnPct">,
  cfg: EngineConfig,
): { pct: number; isDefault: boolean } {
  if (holding.expectedReturnPct !== null && holding.expectedReturnPct !== undefined) {
    return { pct: holding.expectedReturnPct, isDefault: false };
  }
  const category = holding.category ?? defaultCategoryForKind(holding.kind);
  const table = cfg.goals.returnByCategory;
  return { pct: table[category] ?? table.other ?? cfg.goals.defaultInflationPct, isDefault: true };
}

export function bandIndexForYears(years: number, bands: HorizonBand[]): number {
  const i = bands.findIndex((b) => years < b.maxYears);
  return i === -1 ? bands.length - 1 : i;
}

/**
 * Picks the category band for a horizon. Conservative users get the next
 * shorter band's mix; aggressive users the next longer one (but never more
 * equity for goals under 3 years away).
 */
export function bandFor(
  years: number,
  risk: RiskProfile | null,
  cfg: EngineConfig,
): { band: HorizonBand; baseBand: HorizonBand; shifted: boolean } {
  const bands = cfg.goals.horizonBands;
  const baseIndex = bandIndexForYears(years, bands);
  let index = baseIndex;
  if (risk === "conservative") index = Math.max(0, baseIndex - 1);
  if (risk === "aggressive" && years >= cfg.goals.glidePathYears) {
    index = Math.min(bands.length - 1, baseIndex + 1);
  }
  return { band: bands[index], baseBand: bands[baseIndex], shifted: index !== baseIndex };
}

export type GoalStatus = "funded" | "on_track" | "slightly_behind" | "behind";

export interface GoalAnalysis {
  goalId: string;
  name: string;
  type: Goal["type"];
  priority: number;
  targetDate: string;
  months: number;
  years: number;
  inflationPct: number;
  targetToday: number;
  futureTarget: number;
  band: HorizonBand;
  categories: string[];
  returnPct: number;
  savedAmount: number;
  linkedValue: number;
  linkedSip: number;
  currentAmount: number;
  requiredMonthly: number;
  /** Starting SIP needed with the suggested yearly step-up. */
  requiredMonthlyStepUp: number;
  stepUpPct: number;
  alreadyFunded: boolean;
  dueNow: boolean;
  projected: number;
  projectedPct: number;
  status: GoalStatus;
  glidePath: boolean;
  reason: string;
}

export function inflationFor(goal: Goal, cfg: EngineConfig): number {
  if (goal.inflationRate !== null && goal.inflationRate !== undefined) return goal.inflationRate;
  return cfg.goals.inflationByType[goal.type] ?? cfg.goals.defaultInflationPct;
}

export function linkedHoldings(
  goalId: string,
  holdings: Holding[],
  allocations: GoalAllocation[],
): { holding: Holding; percent: number }[] {
  const byId = new Map(holdings.map((h) => [h.id, h]));
  return allocations
    .filter((a) => a.goalId === goalId && byId.has(a.holdingId))
    .map((a) => ({ holding: byId.get(a.holdingId)!, percent: Math.min(100, Math.max(0, a.percent)) }));
}

export function analyzeGoal(
  goal: Goal,
  ctx: {
    holdings: Holding[];
    allocations: GoalAllocation[];
    risk: RiskProfile | null;
    todayISO: string;
    cfg: EngineConfig;
  },
): GoalAnalysis {
  const { cfg } = ctx;
  const months = monthsBetween(ctx.todayISO, goal.targetDate);
  const years = months / 12;
  const inflationPct = inflationFor(goal, cfg);
  const futureTarget = Math.round(futureValue(goal.targetToday, inflationPct, years));
  const { band, shifted } = bandFor(years, ctx.risk, cfg);
  const categories =
    goal.type === "retirement" && years >= 5
      ? [...band.categories, ...cfg.goals.retirementExtraCategories]
      : band.categories;

  const links = linkedHoldings(goal.id, ctx.holdings, ctx.allocations);
  const linkedValue = Math.round(
    links.reduce((s, l) => s + (l.holding.currentValue * l.percent) / 100, 0),
  );
  const linkedSip = Math.round(
    links.reduce((s, l) => s + ((l.holding.monthlySip ?? 0) * l.percent) / 100, 0),
  );
  const currentAmount = Math.max(0, goal.savedAmount) + linkedValue;

  const rawSip = requiredSip(futureTarget, currentAmount, band.returnPct, months);
  const alreadyFunded = rawSip <= 0;
  const dueNow = months <= 0 && !alreadyFunded;
  const requiredMonthly = alreadyFunded ? 0 : Math.ceil(rawSip);

  // Money saved directly on the goal grows at the band's return. Each linked
  // holding (its value and its SIP, with any step-up) grows at its own return.
  const projected = Math.round(
    projectedValue(Math.max(0, goal.savedAmount), 0, band.returnPct, months) +
      links.reduce((s, l) => {
        const share = l.percent / 100;
        const ret = expectedReturnFor(l.holding, cfg).pct;
        return (
          s +
          projectedValue(l.holding.currentValue * share, 0, ret, months) +
          stepUpSipValue((l.holding.monthlySip ?? 0) * share, l.holding.sipStepUpPct ?? 0, ret, months)
        );
      }, 0),
  );
  const stepUpPct = cfg.goals.suggestedStepUpPct;
  const requiredMonthlyStepUp = alreadyFunded
    ? 0
    : Math.ceil(requiredStepUpSip(futureTarget, currentAmount, band.returnPct, months, stepUpPct));
  const projectedPct = futureTarget > 0 ? projected / futureTarget : 1;
  let status: GoalStatus;
  if (alreadyFunded) status = "funded";
  else if (projectedPct >= cfg.goals.status.onTrack) status = "on_track";
  else if (projectedPct >= cfg.goals.status.slightlyBehind) status = "slightly_behind";
  else status = "behind";

  const hasEquity = links.some(
    (l) => l.percent > 0 && l.holding.currentValue > 0 && isEquity(l.holding.kind, l.holding.category),
  );
  const glidePath = hasEquity && years <= cfg.goals.glidePathYears;

  let reason: string;
  if (alreadyFunded) {
    reason = "What you have already should grow to the target. No new money needed.";
  } else if (dueNow) {
    reason = "This goal is due now, so the full remaining amount is needed today.";
  } else {
    reason = `${band.label} away, so we plan with ${band.returnPct}% a year using categories like ${band.categories[0]}${
      shifted ? ", adjusted for your risk comfort" : ""
    }.`;
  }
  if (glidePath) {
    reason += " Start moving this goal to debt: shift about a third of its equity each year.";
  }

  return {
    goalId: goal.id,
    name: goal.name,
    type: goal.type,
    priority: goal.priority,
    targetDate: goal.targetDate,
    months,
    years,
    inflationPct,
    targetToday: goal.targetToday,
    futureTarget,
    band,
    categories,
    returnPct: band.returnPct,
    savedAmount: goal.savedAmount,
    linkedValue,
    linkedSip,
    currentAmount,
    requiredMonthly,
    requiredMonthlyStepUp,
    stepUpPct,
    alreadyFunded,
    dueNow,
    projected,
    projectedPct,
    status,
    glidePath,
    reason,
  };
}

/** Goals in funding order: user priority (1 first), then nearest date. */
export function sortGoalsForFunding<T extends { priority: number; targetDate: string }>(goals: T[]): T[] {
  return [...goals].sort(
    (a, b) => a.priority - b.priority || a.targetDate.localeCompare(b.targetDate),
  );
}

/**
 * Hands out a monthly amount: retirement baseline first, then goals by
 * funding order, each up to what it needs.
 */
export function allocateToGoals(
  analyses: GoalAnalysis[],
  monthly: number,
  retirementBaseline: number,
): { goalId: string; amount: number }[] {
  const out = new Map<string, number>();
  let left = Math.max(0, Math.round(monthly));
  const retirement = analyses.find((a) => a.type === "retirement" && !a.alreadyFunded);
  if (retirement && retirementBaseline > 0) {
    const give = Math.min(left, Math.round(retirementBaseline));
    out.set(retirement.goalId, give);
    left -= give;
  }
  for (const g of sortGoalsForFunding(analyses)) {
    if (left <= 0) break;
    const need = Math.max(0, g.requiredMonthly - (out.get(g.goalId) ?? 0) - g.linkedSip);
    const give = Math.min(left, need);
    if (give > 0) {
      out.set(g.goalId, (out.get(g.goalId) ?? 0) + give);
      left -= give;
    }
  }
  return [...out.entries()].map(([goalId, amount]) => ({ goalId, amount }));
}

/** Suggested retirement target in today's rupees and its date from age. */
export function suggestRetirement(
  annualEssentials: number,
  age: number | null,
  todayISO: string,
  cfg: EngineConfig,
): { targetToday: number; targetDate: string | null; reason: string } {
  const targetToday = Math.round(annualEssentials * cfg.goals.retirementCorpusYears);
  let targetDate: string | null = null;
  if (age !== null) {
    const yearsLeft = Math.max(1, cfg.goals.retirementAge - age);
    const y = Number(todayISO.slice(0, 4)) + yearsLeft;
    targetDate = `${y}${todayISO.slice(4, 10)}`;
  }
  return {
    targetToday,
    targetDate,
    reason: `About ${cfg.goals.retirementCorpusYears} years of today's essential spending, retiring at ${cfg.goals.retirementAge}.`,
  };
}
