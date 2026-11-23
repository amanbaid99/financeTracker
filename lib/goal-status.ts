// How the Goals list labels and groups each goal. Presentation only: the
// plan and its calculations never read these.

import type { Suggestion } from "./allocate";
import { formatINR, formatMonths } from "./format";
import { monthYear, type Tone } from "./goal-summary";
import type { TrackedGoal } from "./tracker";

export interface GoalStatus {
  label: string;
  tone: Tone;
}

/** A bills fund running short this soon needs action, not just a nudge. */
const URGENT_DAYS = 92;

/** A short label for a goal's state: "On track", "Behind", "Short in Feb"... */
/**
 * Between jobs, savings goals that need money aren't "behind": they wait for
 * the salary, as planned. Bills funds and loans keep their real status.
 */
export function onHold(g: TrackedGoal, between: boolean): boolean {
  if (!between || g.billsFund || g.status === "reached") return false;
  if (g.loanState && g.emisCloseFirst) return false;
  return (
    g.status === "behind" ||
    g.status === "no_investments" ||
    (!g.targetDate && g.monthsToReach === null)
  );
}

export function goalStatus(
  g: TrackedGoal,
  today: string,
  between = false,
): GoalStatus {
  if (onHold(g, between))
    return { label: "On hold till salary", tone: "muted" };
  if(g.loanState&&g.emisCloseFirst)return {label:"EMIs cover it",tone:"success"};
  if(g.funding){const f=g.funding;if(g.completed)return {label:"Completed",tone:"success"};if(f.needsDate)return {label:"Needs a date",tone:"muted"};return {label:({fully_funded:"Fully funded",on_track:"On track with plan",at_risk:"At risk",underfunded:"Underfunded"})[f.status],tone:f.status==="fully_funded"||f.status==="on_track"?"success":f.status==="at_risk"?"warning":"danger"};}
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

export type Horizon =
  | "month"
  | "quarter"
  | "half"
  | "year"
  | "five"
  | "beyond"
  | "ongoing";

/** Time groups on the Goals list, nearest first, with their headings. */
export const HORIZONS: { key: Horizon; title: string }[] = [
  { key: "month", title: "Next month" },
  { key: "quarter", title: "This quarter" },
  { key: "half", title: "Next 6 months" },
  { key: "year", title: "Within a year" },
  { key: "five", title: "1 to 5 years" },
  { key: "beyond", title: "5+ years" },
  { key: "ongoing", title: "No fixed date" },
];

const DAY = 24 * 3600 * 1000;

/** When a goal next needs money: its date, or a bills fund's next payment. */
export function horizonDate(g: TrackedGoal): string | null {
  if (g.billsFund) return g.billsFund.upcoming[0]?.date ?? null;
  return g.targetDate;
}

/** Which time group a goal falls in. A date already passed counts as next month. */
export function horizonGroup(g: TrackedGoal, today: string): Horizon {
  const date = horizonDate(g);
  if (!date) return "ongoing";
  const days = (Date.parse(date) - Date.parse(today)) / DAY;
  if (days <= 31) return "month";
  if (days <= 92) return "quarter";
  if (days <= 183) return "half";
  if (days <= 366) return "year";
  if (days <= 5 * 365.25) return "five";
  return "beyond";
}

/** Sort rank: nearer groups first. */
export const horizonRank = (h: Horizon) =>
  HORIZONS.findIndex((x) => x.key === h);

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
  between = false,
): string {
  if (onHold(g, between)) return "starts after salary";
  if(g.funding)return g.funding.needsDate?"Add a date to project this goal":g.funding.monthlyShortfall>0?`${formatINR(g.funding.monthlyShortfall)}/mo short`:`${formatINR(g.funding.recommendedMonthly)}/mo in your plan`;
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
  /** Extra a month, beyond what's going in and the plan, to keep the date and target. */
  moreMonthly: number;
  /** Nothing going in yet, so it's "start" rather than "more". */
  fromZero: boolean;
}

/**
 * For a dated savings goal still behind after the plan: how much more a
 * month keeps it on track. Kept to one simple step on purpose.
 */
export function gapOptions(
  g: TrackedGoal,
  _today: string,
  planMonthly = 0,
): GapOptions | null {
  if (g.loanState || g.billsFund || !g.targetDate || !g.months) return null;
  if (g.status !== "behind") return null;
  const moreMonthly = Math.max(0, g.extraSipNeeded - planMonthly);
  if (moreMonthly <= 0) return null;
  return { moreMonthly, fromZero: g.monthlySip + planMonthly === 0 };
}
