// One order for goals everywhere: bills funds first, then your own order
// (or the app's), with loans the EMIs already close after the rest unless
// you've placed them, and goals reached last. Being on hold doesn't move a
// goal: it keeps its place and says so. Pure: callers pass today.

import { horizonGroup, horizonRank } from "./goal-status";
import type { TrackedGoal } from "./tracker";

/** Loans that close on their EMIs alone need nothing from you. */
const autoLoan = (g: TrackedGoal) => !!(g.loanState && g.emisCloseFirst);

/** The plan's order: bills funds, then your order or the app's. */
export function planOrder<T extends TrackedGoal>(
  goals: T[],
  today: string,
): T[] {
  const custom = goals.some((g) => !g.billsFund && g.planRank != null);
  return [...goals].sort(
    (a, b) =>
      Number(!!b.billsFund) - Number(!!a.billsFund) ||
      (custom
        ? (a.planRank ?? 999) - (b.planRank ?? 999) ||
          Number(autoLoan(a)) - Number(autoLoan(b))
        : Number(autoLoan(a)) - Number(autoLoan(b)) ||
          Number(b.type === "emergency_fund") -
            Number(a.type === "emergency_fund") ||
          horizonRank(horizonGroup(a, today)) -
            horizonRank(horizonGroup(b, today)) ||
          (a.months ?? 999) - (b.months ?? 999)),
  );
}

/** All goals, in order, with goals reached at the end. */
export function orderGoals<T extends TrackedGoal>(
  goals: T[],
  today: string,
): T[] {
  return [...planOrder(goals, today)].sort(
    (a, b) => Number(a.status === "reached") - Number(b.status === "reached"),
  );
}
