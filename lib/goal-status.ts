// How the Goals list labels and groups each goal. Presentation only: the
// plan and its calculations never read these.

import type { Suggestion } from "./allocate";
import { addMonths, monthsBetween } from "./dates";
import { formatINR, formatMonths } from "./format";
import { monthYear, type Tone } from "./goal-summary";
import { projectedValue, type TrackedGoal } from "./tracker";

export interface GoalStatus {
  label: string;
  tone: Tone;
}

/** A bills fund running short this soon needs action, not just a nudge. */
const URGENT_DAYS = 92;

/** A short label for a goal's state: "On track", "Behind", "Short in Feb"... */
export function goalStatus(g: TrackedGoal, today: string): GoalStatus {
  if (g.status === "reached") return { label: "Reached", tone: "success" };
  if (g.status === "overdue") return { label: "Date passed", tone: "danger" };
  const bf = g.billsFund;
  if (bf) {
    if (!bf.bills.length) return { label: "Add bills", tone: "muted" };
    if (!bf.short) return { label: "Covered", tone: "success" };
    const days =
      (Date.parse(bf.short.by) - Date.parse(today)) / (24 * 3600 * 1000);
    return {
      label: `Short in ${monthYear(bf.short.by).split(" ")[0]}`,
      tone: days <= URGENT_DAYS ? "danger" : "warning",
    };
  }
  if (g.loanState && g.emisCloseFirst)
    return { label: "EMIs cover it", tone: "success" };
  if (g.status === "no_investments")
    return { label: "Not started", tone: "muted" };
  if (g.status === "behind") return { label: "Behind", tone: "warning" };
  if (!g.targetDate && g.monthsToReach === null)
    return { label: "Behind", tone: "warning" };
  return { label: "On track", tone: "success" };
}

export type TimeGroup = "soon" | "later" | "ongoing";

/** Next 2 years, later, or no fixed date. Bills funds always count as soon. */
export function timeGroup(g: TrackedGoal): TimeGroup {
  if (g.billsFund) return "soon";
  if (!g.targetDate || g.months === null) return "ongoing";
  return g.months <= 24 ? "soon" : "later";
}

/** The line under a goal's name: its date and time left, or what it's for. */
export function goalSubline(g: TrackedGoal): string {
  if (g.billsFund) {
    const next = g.billsFund.upcoming[0];
    return next ? `Next: ${next.name}, ${formatDayMonth(next.date)}` : "";
  }
  if (g.loanState) {
    const when = g.targetDate ? `Close by ${monthYear(g.targetDate)}` : "";
    const saves =
      !g.emisCloseFirst && g.netSaving > 0
        ? `saves ${formatINR(g.netSaving)}`
        : "";
    return [when, saves].filter(Boolean).join(" · ");
  }
  if (!g.targetDate) return "";
  return g.months && g.months > 0
    ? `${monthYear(g.targetDate)} · ${formatMonths(g.months)}`
    : monthYear(g.targetDate);
}

function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${"Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")[m - 1]}`;
}

/** A short note on the right of a goal card: what happens next. */
export function goalHint(
  g: TrackedGoal,
  today: string,
  suggestion?: Suggestion,
): string {
  const st = goalStatus(g, today);
  const bf = g.billsFund;
  if (bf) {
    const miss = bf.upcoming.find((e) => !e.covered);
    if (suggestion) return "plan covers it";
    return miss ? `${miss.name} not covered` : "";
  }
  if (st.label === "Not started") return g.lines.length ? "" : "link savings";
  if (st.tone === "warning" || st.tone === "danger") {
    if (suggestion) {
      const after = goalStatus(suggestion.after, today);
      return after.tone === "success" ? "plan covers it" : "needs a decision";
    }
    return g.extraSipNeeded > 0 ? `+${formatINR(g.extraSipNeeded)}/mo` : "";
  }
  if (!g.targetDate && g.reachDate) return `around ${monthYear(g.reachDate)}`;
  return "";
}

export interface GapOptions {
  /** A later date the goal can be reached by with what's going in. */
  newDate: string | null;
  /** A smaller target, in today's money, that's reachable by the date. */
  lowerTarget: number | null;
  /** Extra a month still needed to keep the date and target. */
  moreMonthly: number;
}

/**
 * For a dated savings goal still behind after the plan: three ways to close
 * the gap. `planMonthly` is what the plan adds; it counts toward each one.
 */
export function gapOptions(
  g: TrackedGoal,
  today: string,
  planMonthly = 0,
): GapOptions | null {
  if (g.loanState || g.billsFund || !g.targetDate || !g.months) return null;
  if (g.status !== "behind") return null;
  const sip = g.monthlySip + planMonthly;
  const moreMonthly = Math.max(0, g.extraSipNeeded - planMonthly);
  if (moreMonthly <= 0) return null;
  const infl = (g.inflationPct ?? 0) / 100;
  const grown = (m: number) => g.target * Math.pow(1 + infl, m / 12);

  // Smallest number of months (up to 40 years) where saving meets the
  // target, which also grows with prices.
  let newDate: string | null = null;
  for (let m = g.months + 1; m <= 480; m++) {
    if (projectedValue(g.current, sip, g.returnPct, m) >= grown(m)) {
      newDate = addMonths(today, m);
      break;
    }
  }
  // What's reachable by the date, back in today's money, rounded down.
  const reach = projectedValue(g.current, sip, g.returnPct, g.months);
  const today$ = reach / Math.pow(1 + infl, g.months / 12);
  const step = today$ >= 1e5 ? 10000 : 1000;
  const lower = Math.floor(today$ / step) * step;
  return {
    newDate:
      newDate && monthsBetween(today, newDate) > g.months ? newDate : null,
    lowerTarget: lower > 0 && lower < g.target ? lower : null,
    moreMonthly,
  };
}
