// How a monthly amount is split across goals, in steps you can follow:
//   1. Emergency fund floor: 1 month of fixed costs within 3 months, then
//      3 months of costs within 6 months.
//   2. Bills funds: what's needed each month to pay the bills coming up.
//   3. ₹500 to every other goal, so everything moves forward.
//   4. The rest to the closest goal first, then the next, up to what each needs.
// Pure: callers pass today and the amounts. Suggestions only.

import { formatINR } from "./format";
import type { TrackedGoal } from "./tracker";

export const PROGRESS_MINIMUM = 500;
const STEP = 100;

export interface StepLine {
  goalId: string;
  goalName: string;
  monthly: number;
  /** Plain reason for this amount. */
  why: string;
}

export interface StepPlan {
  lines: StepLine[];
  /** What all goals need a month (the plan's ceiling without a budget). */
  need: number;
  /** Amount split (budget, or the need when there's no budget). */
  basis: number;
  /** Left over after every goal got what it needs. */
  left: number;
}

const live = (g: TrackedGoal) =>
  g.status !== "reached" && !(g.loanState && g.emisCloseFirst);

const roundUp = (n: number) => Math.ceil(Math.max(0, n) / STEP) * STEP;

/** The emergency fund's bare minimum a month, and why. */
export function emergencyFloor(
  g: TrackedGoal,
  essentialsMonthly: number,
): { monthly: number; why: string } {
  if (essentialsMonthly <= 0) {
    const months = g.months && g.months > 0 ? g.months : 12;
    return {
      monthly: roundUp((g.futureTarget - g.current) / months),
      why: `Builds it over ${months} months. Add your costs in Budget for a sharper figure.`,
    };
  }
  const one = Math.min(essentialsMonthly, g.futureTarget);
  const three = Math.min(essentialsMonthly * 3, g.futureTarget);
  const first = Math.max(0, one - g.current);
  const next = Math.max(0, three - Math.max(g.current, one));
  const monthly = roundUp(first / 3 + next / 6);
  return {
    monthly,
    why:
      first > 0
        ? `1 month of costs (${formatINR(one)}) within 3 months, then 3 months within 6.`
        : next > 0
          ? `3 months of costs (${formatINR(three)}) within 6 months.`
          : "It already holds 3 months of costs.",
  };
}

/** What a goal needs a month to be on time (its whole remaining pace). */
function fullNeed(g: TrackedGoal): number {
  if (g.billsFund) return roundUp(g.billsFund.monthlyNeed);
  if (g.months === null || g.months <= 0)
    return roundUp(g.monthlySip + g.extraSipNeeded);
  return roundUp(g.monthlySip + g.extraSipNeeded);
}

/** Splits `budget` (or, with no budget, exactly what goals need) across goals. */
export function stepAllocation(opts: {
  goals: TrackedGoal[];
  essentialsMonthly: number;
  /** Monthly amount to split; 0 or less means "show what goals need". */
  budget: number;
}): StepPlan {
  const goals = opts.goals.filter(live);
  const emergency = goals.find((g) => g.type === "emergency_fund");
  const bills = goals.filter((g) => !!g.billsFund);
  // Closest first: dated goals by months left, then goals without a date.
  const others = goals
    .filter((g) => g !== emergency && !g.billsFund)
    .sort(
      (a, b) =>
        (a.months ?? 9999) - (b.months ?? 9999) ||
        Number(!!a.niceToHave) - Number(!!b.niceToHave),
    );

  const floor = emergency
    ? emergencyFloor(emergency, opts.essentialsMonthly)
    : null;
  const needs = new Map<string, number>();
  for (const g of goals)
    needs.set(
      g.id,
      g === emergency || g.billsFund
        ? fullNeed(g)
        : Math.max(PROGRESS_MINIMUM, fullNeed(g)),
    );
  if (emergency && floor)
    needs.set(
      emergency.id,
      Math.max(floor.monthly, needs.get(emergency.id) ?? 0),
    );
  const need = [...needs.values()].reduce((a, b) => a + b, 0);
  const basis = opts.budget > 0 ? opts.budget : need;

  let left = basis;
  const got = new Map<string, number>();
  const why = new Map<string, string>();
  const give = (
    g: TrackedGoal,
    amount: number,
    reason?: string,
    anyway = false,
  ) => {
    const room = anyway
      ? amount
      : Math.max(0, (needs.get(g.id) ?? 0) - (got.get(g.id) ?? 0));
    const take = Math.min(left, amount, room);
    if (take <= 0) return;
    got.set(g.id, (got.get(g.id) ?? 0) + take);
    left -= take;
    if (reason && !why.has(g.id)) why.set(g.id, reason);
  };

  // 1. Emergency floor.
  if (emergency && floor) give(emergency, floor.monthly, floor.why);
  // 2. Bills coming up.
  for (const g of bills)
    give(g, needs.get(g.id) ?? 0, "What the bills coming up need each month.");
  // 3. A little for every other goal, if the budget stretches that far.
  if (left >= PROGRESS_MINIMUM * others.length)
    for (const g of others)
      give(
        g,
        PROGRESS_MINIMUM,
        `${formatINR(PROGRESS_MINIMUM)} to keep it moving.`,
        true,
      );
  // 4. The rest: closest goal first, each up to what it needs.
  for (const g of others)
    give(
      g,
      needs.get(g.id) ?? 0,
      g.months !== null
        ? `Closest goals first: ${g.months} months away.`
        : "After dated goals.",
    );
  // Then the rest of the emergency fund's own pace, if any.
  if (emergency) give(emergency, needs.get(emergency.id) ?? 0);

  const lines = goals
    .map((g) => {
      const monthly = got.get(g.id) ?? 0;
      const reason =
        monthly > PROGRESS_MINIMUM &&
        why.get(g.id)?.startsWith(formatINR(PROGRESS_MINIMUM))
          ? g.months !== null
            ? `Closest goals first: ${g.months} months away.`
            : "After dated goals."
          : (why.get(g.id) ?? "Nothing left for it this month.");
      return {
        goalId: g.id,
        goalName: g.name,
        monthly,
        why: monthly > 0 ? reason : "Nothing left for it this month.",
      };
    })
    .filter((l) => l.monthly > 0 || opts.budget > 0);
  return { lines, need, basis, left: Math.max(0, left) };
}
