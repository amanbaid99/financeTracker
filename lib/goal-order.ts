// One order for goals everywhere: the plan's order (bills funds first, then
// your own order or the app's), with goals on hold and goals reached after
// the ones that need money now. Pure: callers pass today.

import { horizonGroup, horizonRank, onHold } from "./goal-status";
import type { TrackedGoal } from "./tracker";

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
        ? (a.planRank ?? 999) - (b.planRank ?? 999)
        : Number(b.type === "emergency_fund") -
            Number(a.type === "emergency_fund") ||
          horizonRank(horizonGroup(a, today)) -
            horizonRank(horizonGroup(b, today)) ||
          (a.months ?? 999) - (b.months ?? 999)),
  );
}

/** All goals, in order: active first, then on hold, then reached. */
export function orderGoals<T extends TrackedGoal>(
  goals: T[],
  today: string,
  between = false,
): T[] {
  const stage = (g: T) =>
    g.status === "reached" ? 2 : onHold(g, between) ? 1 : 0;
  const plan = planOrder(goals, today);
  return [...plan].sort((a, b) => stage(a) - stage(b));
}
