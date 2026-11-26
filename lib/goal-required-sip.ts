import { requiredSip, type TrackedGoal } from "./tracker";
/** Total monthly funding needed, not the extra amount above an existing SIP. */
export function goalRequiredSip(goal: TrackedGoal): number | null {
  if (goal.loanState && goal.emisCloseFirst && goal.months !== null) return 0;
  if (goal.billsFund) return Math.max(0,Math.ceil(goal.billsFund.monthlyNeed));
  if (goal.months === null || goal.months <= 0) return null;
  return Math.max(0,Math.ceil(requiredSip(goal.futureTarget,goal.current,goal.returnPct,goal.months)));
}
