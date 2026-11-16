// The plan as a journey: what happens next, then after that, with where you
// are now. Built from what the app already knows (goals, loans, bills funds,
// salary dates); nothing here is saved. Pure: callers pass today in.

import { addMonths } from "./dates";
import { goalStatus } from "./goal-status";
import { loanView, type Loan } from "./loans";
import type { TrackedGoal } from "./tracker";

export type StepStatus = "done" | "on" | "hold" | "needs" | "info";

export interface RoadStep {
  key: string;
  /** yyyy-mm-dd, or null for "no date yet". */
  date: string | null;
  title: string;
  sub: string;
  status: StepStatus;
  href?: string;
}

export interface Roadmap {
  done: RoadStep[];
  ahead: RoadStep[];
  /** Goals with no date to place them. */
  undated: RoadStep[];
}

/** Bill months below this, when covered, stay off the roadmap. */
const SMALL_BILLS = 5000;

const monthName = (iso: string) =>
  "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")[
    Number(iso.slice(5, 7)) - 1
  ];
const dayMonth = (iso: string) =>
  `${Number(iso.slice(8, 10))} ${monthName(iso)}`;
const compact = (n: number) =>
  n >= 1e7
    ? `₹${(n / 1e7).toFixed(2).replace(/\.?0+$/, "")} Cr`
    : n >= 1e5
      ? `₹${(n / 1e5).toFixed(1).replace(/\.0$/, "")}L`
      : `₹${Math.round(n).toLocaleString("en-IN")}`;

function goalStep(g: TrackedGoal, today: string, between: boolean): StepStatus {
  const st = goalStatus(g, today, between);
  if (g.status === "reached") return "done";
  if (st.label === "On hold till salary") return "hold";
  if (st.tone === "success") return "on";
  return "needs";
}

export function roadmap(opts: {
  today: string;
  goals: TrackedGoal[];
  loans: Loan[];
  /** Between jobs: salary dates, and whether the money lasts till then. */
  salary?: { best: string; worst: string; covered: boolean | null } | null;
}): Roadmap {
  const { today, goals, loans, salary } = opts;
  const between = !!salary && salary.worst >= today;
  const done: RoadStep[] = [];
  const ahead: RoadStep[] = [];
  const undated: RoadStep[] = [];

  if (between && salary) {
    ahead.push({
      key: "salary",
      date: salary.best,
      title: "First salary",
      sub:
        salary.best === salary.worst
          ? `Expected ${dayMonth(salary.best)}.`
          : `Between ${dayMonth(salary.best)} and ${dayMonth(salary.worst)}.${
              salary.covered === true
                ? " You're covered till then."
                : salary.covered === false
                  ? " There's a gap to close before it."
                  : ""
            }`,
      status: salary.covered === false ? "needs" : "info",
      href: "/goals/runway",
    });
    const restart = `${addMonths(salary.worst, 1).slice(0, 7)}-01`;
    if (goals.some((g) => goalStep(g, today, true) === "hold"))
      ahead.push({
        key: "restart",
        date: restart,
        title: "Savings goals restart",
        sub: "Goals on hold start getting money again, in your order.",
        status: "info",
        href: "/goals/plan",
      });
  }

  // Bills funds: one step per month with payments, for the next year.
  const until = addMonths(today, 12);
  const byMonth = new Map<
    string,
    { names: string[]; total: number; short: boolean; goalId: string }
  >();
  for (const g of goals) {
    for (const e of g.billsFund?.upcoming ?? []) {
      if (e.date < today || e.date > until) continue;
      const m = e.date.slice(0, 7);
      const cur = byMonth.get(m) ?? {
        names: [],
        total: 0,
        short: false,
        goalId: g.id,
      };
      cur.names.push(e.name);
      cur.total += e.amount;
      cur.short ||= !e.covered;
      byMonth.set(m, cur);
    }
  }
  for (const [m, b] of byMonth) {
    // Small, covered months are noise on a roadmap; Goals has the detail.
    if (b.total < SMALL_BILLS && !b.short) continue;
    ahead.push({
      key: `bills:${m}`,
      date: `${m}-01`,
      title: `Bills: ${compact(b.total)}`,
      sub: b.names.join(", "),
      status: b.short ? (between ? "hold" : "needs") : "on",
      href: `/goals?open=${b.goalId}`,
    });
  }

  // Loans: paid off at the current EMI, or closed early by a goal's date.
  for (const l of loans) {
    const v = loanView(l, today);
    if (v.closed) {
      done.push({
        key: `loan:${l.id}`,
        date: null,
        title: `${l.name} paid off`,
        sub: "Closed.",
        status: "done",
        href: "/cards#loans-h",
      });
      continue;
    }
    const goal = goals.find((g) => g.loanId === l.id && g.targetDate);
    const end = v.state.endDate;
    if (goal && (!end || goal.targetDate! < end))
      ahead.push({
        key: `loan:${l.id}`,
        date: goal.targetDate,
        title: `Close ${l.name} early`,
        sub: end
          ? `Instead of ${monthName(end)} ${end.slice(0, 4)} on EMIs alone.`
          : "Saving to close it.",
        status: goalStep(goal, today, between),
        href: `/goals?open=${goal.id}`,
      });
    else if (end)
      ahead.push({
        key: `loan:${l.id}`,
        date: end,
        title: `${l.name} paid off`,
        sub: `${compact(v.state.balance)} left, cleared by EMIs.`,
        status: "on",
        href: "/cards#loans-h",
      });
  }

  // Savings goals.
  for (const g of goals) {
    if (g.billsFund || g.loanState) continue;
    const status = goalStep(g, today, between);
    const step: RoadStep = {
      key: `goal:${g.id}`,
      date: g.targetDate ?? (status === "on" ? g.reachDate : null),
      title: `${g.name}: ${compact(g.futureTarget)}`,
      sub:
        status === "done"
          ? "Reached."
          : status === "hold"
            ? "On hold till salary."
            : status === "on"
              ? g.targetDate
                ? "On track."
                : "On track to get there around then."
              : g.extraSipNeeded > 0
                ? `Needs about ${compact(g.extraSipNeeded)} a month more.`
                : "Needs a plan.",
      status,
      href: `/goals?open=${g.id}`,
    };
    if (status === "done") done.push(step);
    else if (step.date) ahead.push(step);
    else undated.push(step);
  }

  ahead.sort(
    (a, b) => a.date!.localeCompare(b.date!) || a.title.localeCompare(b.title),
  );
  return { done, ahead, undated };
}
