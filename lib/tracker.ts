// Goal tracking: how much each goal has, where it's heading and what it needs.
// Pure functions; callers pass "today" in.

import { addMonths, monthsBetween } from "./dates";
import { defaultReturn } from "./instruments";

export interface Investment {
  id: string;
  kind: string;
  name: string | null;
  category: string | null;
  value: number;
  monthlySip: number;
  /** User's own return %, or null for the type's default. */
  returnPct: number | null;
}

export interface GoalInput {
  id: string;
  name: string;
  target: number;
  /** yyyy-mm-dd, or null for no fixed date. */
  targetDate: string | null;
  /** % a year to grow the target by, or null for none. */
  inflationPct: number | null;
}

export interface Link {
  goalId: string;
  investmentId: string;
  /** Share of the investment that belongs to this goal, 0 to 100. */
  percent: number;
}

export type GoalStatus = "reached" | "on_track" | "behind" | "no_investments" | "overdue";

export interface GoalLine {
  investment: Investment;
  percent: number;
  /** This goal's share of the value and SIP. */
  value: number;
  monthlySip: number;
  returnPct: number;
}

export interface TrackedGoal extends GoalInput {
  lines: GoalLine[];
  current: number;
  monthlySip: number;
  /** Blended planning return, % a year. */
  returnPct: number;
  /** Target in rupees of the target date (after inflation, if set). */
  futureTarget: number;
  progress: number;
  months: number | null;
  /** Value expected on the target date at the current pace. */
  projected: number | null;
  /** Extra SIP a month needed to reach the target on time. */
  extraSipNeeded: number;
  /** For goals with no date: months until reached at this pace (null if never). */
  monthsToReach: number | null;
  reachDate: string | null;
  status: GoalStatus;
}

const MAX_MONTHS = 600;

/** Value after `months` with savings growing and a SIP paid at the start of each month. */
export function projectedValue(saved: number, sip: number, annualPct: number, months: number): number {
  if (months <= 0) return saved;
  const r = annualPct / 100 / 12;
  if (r === 0) return saved + sip * months;
  const g = Math.pow(1 + r, months);
  return saved * g + (sip * (g - 1) * (1 + r)) / r;
}

/** Monthly SIP needed to reach `target` in `months` from `saved`. Zero if already enough. */
export function requiredSip(target: number, saved: number, annualPct: number, months: number): number {
  if (months <= 0) return Math.max(0, target - saved);
  const r = annualPct / 100 / 12;
  const g = Math.pow(1 + r, months);
  const gap = target - saved * g;
  if (gap <= 0) return 0;
  return r === 0 ? gap / months : (gap * r) / ((g - 1) * (1 + r));
}

/** Months until `target` is reached, or null if not within 50 years. */
export function monthsToReach(target: number, saved: number, sip: number, annualPct: number): number | null {
  if (saved >= target) return 0;
  for (let m = 1; m <= MAX_MONTHS; m++) {
    if (projectedValue(saved, sip, annualPct, m) >= target) return m;
  }
  return null;
}

export function trackGoal(goal: GoalInput, investments: Investment[], links: Link[], todayISO: string): TrackedGoal {
  const byId = new Map(investments.map((i) => [i.id, i]));
  const lines: GoalLine[] = links
    .filter((l) => l.goalId === goal.id && byId.has(l.investmentId))
    .map((l) => {
      const inv = byId.get(l.investmentId)!;
      const share = l.percent / 100;
      return {
        investment: inv,
        percent: l.percent,
        value: Math.round(inv.value * share),
        monthlySip: Math.round(inv.monthlySip * share),
        returnPct: inv.returnPct ?? defaultReturn(inv.kind, inv.category),
      };
    });

  const current = lines.reduce((s, l) => s + l.value, 0);
  const monthlySip = lines.reduce((s, l) => s + l.monthlySip, 0);
  // Blend returns by value plus a year of SIPs, so SIP-only funds still count.
  const weight = (l: GoalLine) => l.value + l.monthlySip * 12;
  const totalWeight = lines.reduce((s, l) => s + weight(l), 0);
  const returnPct = totalWeight
    ? Math.round((lines.reduce((s, l) => s + weight(l) * l.returnPct, 0) / totalWeight) * 10) / 10
    : lines.length
      ? lines[0].returnPct
      : 0;

  const months = goal.targetDate ? monthsBetween(todayISO, goal.targetDate) : null;
  const futureTarget =
    months !== null && goal.inflationPct
      ? Math.round(goal.target * Math.pow(1 + goal.inflationPct / 100, months / 12))
      : goal.target;
  const progress = futureTarget > 0 ? Math.min(1, current / futureTarget) : 1;

  let projected: number | null = null;
  let extraSipNeeded = 0;
  let toReach: number | null = null;
  let status: GoalStatus;

  if (current >= futureTarget) {
    status = "reached";
    toReach = 0;
  } else if (months !== null) {
    projected = Math.round(projectedValue(current, monthlySip, returnPct, months));
    extraSipNeeded = Math.max(0, Math.ceil(requiredSip(futureTarget, current, returnPct, months) - monthlySip));
    if (months === 0) status = "overdue";
    else if (!lines.length) status = "no_investments";
    else status = projected >= futureTarget ? "on_track" : "behind";
  } else {
    toReach = monthsToReach(futureTarget, current, monthlySip, returnPct);
    status = lines.length ? "on_track" : "no_investments";
  }

  return {
    ...goal,
    lines,
    current,
    monthlySip,
    returnPct,
    futureTarget,
    progress,
    months,
    projected,
    extraSipNeeded,
    monthsToReach: toReach,
    reachDate: toReach !== null && months === null ? addMonths(todayISO, toReach) : null,
    status,
  };
}

/** Share of each investment not yet given to any goal, 0 to 100. */
export function freePercent(investmentId: string, links: Link[], exceptGoalId?: string): number {
  const used = links
    .filter((l) => l.investmentId === investmentId && l.goalId !== exceptGoalId)
    .reduce((s, l) => s + l.percent, 0);
  return Math.max(0, Math.round((100 - used) * 100) / 100);
}
