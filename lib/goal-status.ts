// How the Goals list labels and groups each goal. Presentation only: the
// plan and its calculations never read these.

import type { Suggestion } from "./allocate";
import { addMonths } from "./dates";
import { formatINR, formatMonths } from "./format";
import { monthYear, type Tone } from "./goal-summary";
import { requiredSip, type TrackedGoal } from "./tracker";

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
    if (suggestion)
      return goalStatus(suggestion.after, today).tone === "success"
        ? "Covered by your plan"
        : "Plan still leaves a gap";
    return miss ? `${miss.name} not covered` : "";
  }
  if (st.label === "Not started") return g.lines.length ? "" : "link savings";
  if (st.tone === "warning" || st.tone === "danger") {
    if (suggestion) {
      const after = goalStatus(suggestion.after, today);
      return after.tone === "success"
        ? "Covered by your plan"
        : "Needs a decision";
    }
    return g.extraSipNeeded > 0 ? `+${formatINR(g.extraSipNeeded)}/mo` : "";
  }
  if (!g.targetDate && g.reachDate) return `around ${monthYear(g.reachDate)}`;
  return "";
}

export interface GapOptions {
  /** Total a month needed to keep the date and target. */
  neededNow: number;
  /** A later date, with the total a month that then gets there. */
  later: { date: string; monthly: number } | null;
  /** A target a fifth smaller (today's money), with the total a month for it. */
  smaller: { target: number; monthly: number } | null;
  /** Extra a month, beyond what's going in and the plan, to keep both. */
  moreMonthly: number;
  /** Nothing going in yet, so it's "start" rather than "more". */
  fromZero: boolean;
}

const up100 = (n: number) => Math.ceil(n / 100) * 100;

/**
 * For a dated savings goal still behind after the plan: realistic trade-offs,
 * each with what it then takes a month. Never "lower it to whatever today's
 * savings reach", which for a long goal with little invested is meaningless.
 */
export function gapOptions(
  g: TrackedGoal,
  today: string,
  planMonthly = 0,
): GapOptions | null {
  if (g.loanState || g.billsFund || !g.targetDate || !g.months) return null;
  if (g.status !== "behind") return null;
  const going = g.monthlySip + planMonthly;
  const moreMonthly = Math.max(0, g.extraSipNeeded - planMonthly);
  if (moreMonthly <= 0) return null;
  const infl = (g.inflationPct ?? 0) / 100;
  // Total a month to reach `target` (today's money) in `m` months.
  const needed = (target: number, m: number) =>
    up100(
      requiredSip(
        target * Math.pow(1 + infl, m / 12),
        g.current,
        g.returnPct,
        m,
      ),
    );
  const neededNow = needed(g.target, g.months);

  // Push the date out by about a sixth of the time left (6 months to 3 years).
  const shift = Math.min(36, Math.max(6, Math.round(g.months / 6)));
  const laterMonthly = needed(g.target, g.months + shift);
  const later =
    laterMonthly < neededNow * 0.97
      ? { date: addMonths(g.targetDate, shift), monthly: laterMonthly }
      : null;

  // Aim a fifth lower: a real trade-off, not a different goal.
  const raw = g.target * 0.8;
  const step = raw >= 1e7 ? 1e5 : raw >= 1e5 ? 1e4 : 1000;
  const smallerTarget = Math.round(raw / step) * step;
  const smaller =
    smallerTarget > g.current
      ? { target: smallerTarget, monthly: needed(smallerTarget, g.months) }
      : null;

  return { neededNow, later, smaller, moreMonthly, fromZero: going === 0 };
}
