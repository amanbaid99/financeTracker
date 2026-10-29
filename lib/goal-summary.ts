// One-line status for a goal, shared by the list and the goal page.

import { formatDate, formatINR } from "./format";
import type { TrackedGoal } from "./tracker";

export type Tone = "success" | "warning" | "danger" | "muted";

export const monthYear = (iso: string | null) =>
  formatDate(iso).split(" ").slice(1).join(" ");

const dayMonth = (iso: string) =>
  formatDate(iso).split(" ").slice(0, 2).join(" ");

export function goalHeadline(g: TrackedGoal): { text: string; tone: Tone } {
  const bf = g.billsFund;
  if (bf) {
    if (!bf.bills.length)
      return { text: "Add the payments this fund covers", tone: "muted" };
    if (bf.short)
      // A monthly amount can fix it: say so, like other goals do. Otherwise
      // (a payment due before the next deposit) show the gap and its date.
      return bf.monthlyNeed > g.monthlySip
        ? {
            text: `Needs ${formatINR(bf.monthlyNeed - g.monthlySip)} more a month`,
            tone: "warning",
          }
        : {
            text: `${formatINR(bf.short.amount)} short by ${dayMonth(bf.short.by)}`,
            tone: "warning",
          };
    const next = bf.upcoming[0];
    return next
      ? {
          text: `Next: ${next.name} on ${dayMonth(next.date)}, covered`,
          tone: "success",
        }
      : { text: "Nothing due in the next year", tone: "success" };
  }
  const loan = g.type === "loan_payoff";
  switch (g.status) {
    case "reached":
      return {
        text: loan ? "Enough saved to close the loan" : "Goal reached",
        tone: "success",
      };
    case "overdue":
      return { text: "Target date has passed", tone: "danger" };
    case "behind":
      return {
        text: `Needs ${formatINR(g.extraSipNeeded)} more a month`,
        tone: "warning",
      };
    case "no_investments":
      if (loan && g.emisCloseFirst)
        return {
          text: `EMIs close it in ${monthYear(g.reachDate)}`,
          tone: "muted",
        };
      return g.targetDate
        ? {
            text: `Save ${formatINR(g.extraSipNeeded)} a month to get there`,
            tone: "muted",
          }
        : { text: "Add an investment to start", tone: "muted" };
    case "on_track":
      if (loan && g.emisCloseFirst)
        return {
          text: `EMIs close it in ${monthYear(g.reachDate)}`,
          tone: "success",
        };
      if (g.targetDate)
        return {
          text: `On track for ${monthYear(g.targetDate)}`,
          tone: "success",
        };
      if (g.reachDate)
        return {
          text: `${loan ? "Can close it" : "Reached"} around ${monthYear(g.reachDate)}`,
          tone: "success",
        };
      return { text: "Not reached at this pace", tone: "warning" };
  }
}

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  muted: "text-muted-foreground",
};

export const TONE_BAR: Record<
  Tone,
  "success" | "warning" | "danger" | "primary"
> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  muted: "primary",
};

/** Presentation groups only. Never change the funding order or calculations. */
export function groupGoals(goals: TrackedGoal[]) {
  const groups: Record<"attention" | "growing" | "loans" | "reached", TrackedGoal[]> = {
    attention: [], growing: [], loans: [], reached: [],
  };
  for (const goal of sortGoals(goals)) {
    const headline = goalHeadline(goal);
    if (goal.status === "reached") groups.reached.push(goal);
    else if (headline.tone === "warning" || headline.tone === "danger") groups.attention.push(goal);
    else if (goal.loanState && goal.emisCloseFirst) groups.loans.push(goal);
    else if (goal.status === "no_investments") groups.attention.push(goal);
    else groups.growing.push(goal);
  }
  return groups;
}

/**
 * Goals with a date first, soonest first; then goals with no date. Within
 * each, the smaller amount comes first.
 */
export function sortGoals<
  T extends {
    targetDate: string | null;
    futureTarget: number;
    target: number;
    billsFund?: { upcoming: { date: string }[] } | null;
  },
>(goals: T[]): T[] {
  const amount = (g: T) => g.futureTarget || g.target;
  // A bills fund sorts by its next payment.
  const date = (g: T) => g.billsFund?.upcoming[0]?.date ?? g.targetDate;
  return [...goals].sort((a, b) => {
    const da = date(a);
    const db = date(b);
    if (da && db && da !== db) return da < db ? -1 : 1;
    if (!da !== !db) return da ? -1 : 1;
    return amount(a) - amount(b);
  });
}
