// Display order and legacy planning order are kept separate. Flexible goals
// display by deadline; only essentials use saved ranks. Pure: callers pass today.

import { horizonDate, horizonGroup, horizonRank } from "./goal-status";
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

/** Display order is independent of the saved plan: only essentials use custom ranks. */
export function orderGoals<T extends TrackedGoal>(
  goals: T[],
  today: string,
): T[] {
  const essential = (g: TrackedGoal) =>
    (g.goalCategory ??
      (["emergency_fund", "bills_fund", "loan_payoff"].includes(g.type) ||
      !!g.loanState
        ? "essential"
        : "flexible")) === "essential";
  const unattendedLoan = (g: TrackedGoal) => autoLoan(g) && g.planRank == null;
  return [...goals].sort(
    (a, b) =>
      Number(a.status === "reached" || !!a.completed) -
        Number(b.status === "reached" || !!b.completed) ||
      // Same order as the SIP plan: emergency fund, then bills, then the rest.
      Number(b.type === "emergency_fund") - Number(a.type === "emergency_fund") ||
      Number(!!b.billsFund) - Number(!!a.billsFund) ||
      Number(unattendedLoan(a)) - Number(unattendedLoan(b)) ||
      Number(essential(b)) - Number(essential(a)) ||
      (essential(a) && essential(b)
        ? (a.planRank ?? 999) - (b.planRank ?? 999) ||
          Number(b.type === "emergency_fund") -
            Number(a.type === "emergency_fund")
        : 0) ||
      horizonRank(horizonGroup(a, today)) -
        horizonRank(horizonGroup(b, today)) ||
      (horizonDate(a) ?? "9999").localeCompare(horizonDate(b) ?? "9999") ||
      (a.months ?? 999) - (b.months ?? 999) ||
      a.id.localeCompare(b.id),
  );
}
