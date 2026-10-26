// Credit card milestones: which period counts now, how much is spent in it,
// and the pace needed to hit the target. Pure functions; "today" is passed in.

export type Period =
  | "card_year"
  | "calendar_year"
  | "quarter"
  | "month"
  | "once";

export const PERIOD_LABELS: Record<Period, string> = {
  card_year: "Each card year",
  calendar_year: "Each calendar year",
  quarter: "Each quarter",
  month: "Each month",
  once: "Once, by a date",
};

export interface Milestone {
  id: string;
  name: string;
  target: number;
  period: Period;
  deadline: string | null;
  reward: string | null;
  spent: number;
  /** When `spent` was last updated. */
  spentAsOf: string | null;
}

export interface Bill {
  id: string;
  /** First day of the statement month. */
  month: string;
  amount: number;
  dueDate: string | null;
  paid: boolean;
  note: string | null;
}

export interface Card {
  id: string;
  label: string;
  annualFee: number | null;
  /** The day the card year starts (any year; only month and day are used). */
  yearStart: string | null;
  rewards: string | null;
  benefits: string[];
  milestones: Milestone[];
  /** Newest month first. */
  bills: Bill[];
}

export type MilestoneStatus =
  | "achieved"
  | "on_pace"
  | "behind"
  | "missed"
  | "no_end";

export interface MilestoneState extends Milestone {
  /** The period counting now; null end means no deadline. */
  start: string | null;
  end: string | null;
  /** Spend counted in this period (an update from an earlier period counts as 0). */
  spentNow: number;
  /** True when the spend was entered before this period began. */
  stale: boolean;
  progress: number;
  remaining: number;
  daysLeft: number | null;
  /** Spend needed a month from now to reach the target in time. */
  neededPerMonth: number | null;
  status: MilestoneStatus;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
};
const days = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const addDays = (s: string, n: number) =>
  iso(new Date(Date.parse(s) + n * 86_400_000));

/** A month/day in a given year, moved to the 28th for 29 Feb in other years. */
function onDay(y: number, m: number, d: number): string {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return iso(utc(y, m, Math.min(d, last)));
}

/** First and last day of the period that contains `today`. */
export function periodBounds(
  period: Period,
  todayISO: string,
  yearStart: string | null,
  deadline: string | null,
): { start: string | null; end: string | null } {
  const t = parse(todayISO);
  switch (period) {
    case "month":
      return { start: onDay(t.y, t.m, 1), end: onDay(t.y, t.m, 31) };
    case "quarter": {
      const q = Math.floor((t.m - 1) / 3) * 3 + 1;
      return { start: onDay(t.y, q, 1), end: onDay(t.y, q + 2, 31) };
    }
    case "calendar_year":
      return { start: onDay(t.y, 1, 1), end: onDay(t.y, 12, 31) };
    case "card_year": {
      if (!yearStart)
        return { start: onDay(t.y, 1, 1), end: onDay(t.y, 12, 31) };
      const a = parse(yearStart);
      let start = onDay(t.y, a.m, a.d);
      if (start > todayISO) start = onDay(t.y - 1, a.m, a.d);
      const s = parse(start);
      return { start, end: addDays(onDay(s.y + 1, a.m, a.d), -1) };
    }
    case "once":
      return { start: null, end: deadline };
  }
}

export function milestoneState(
  m: Milestone,
  todayISO: string,
  yearStart: string | null,
): MilestoneState {
  const { start, end } = periodBounds(
    m.period,
    todayISO,
    yearStart,
    m.deadline,
  );
  const stale = Boolean(
    start && m.spent > 0 && (!m.spentAsOf || m.spentAsOf < start),
  );
  const spentNow = stale ? 0 : m.spent;
  const remaining = Math.max(0, m.target - spentNow);
  const progress = Math.min(1, spentNow / m.target);
  const daysLeft = end ? Math.max(0, days(todayISO, end) + 1) : null;
  const neededPerMonth =
    daysLeft === null || remaining === 0
      ? null
      : Math.ceil(remaining / Math.max(daysLeft / 30.44, 1 / 30.44));

  let status: MilestoneStatus;
  if (remaining === 0) status = "achieved";
  else if (end && todayISO > end) status = "missed";
  else if (!start || !end) status = "no_end";
  else {
    const elapsed = (days(start, todayISO) + 1) / (days(start, end) + 1);
    status = progress >= elapsed - 0.05 ? "on_pace" : "behind";
  }
  return {
    ...m,
    start,
    end,
    spentNow,
    stale,
    progress,
    remaining,
    daysLeft,
    neededPerMonth,
    status,
  };
}

/** The milestone to show on the card's row: the soonest one not yet hit. */
export function headlineMilestone(
  states: MilestoneState[],
): MilestoneState | null {
  const open = states.filter(
    (s) => s.status !== "achieved" && s.status !== "missed",
  );
  const pool = open.length ? open : states;
  return (
    [...pool].sort(
      (a, b) =>
        (a.end ?? "9999").localeCompare(b.end ?? "9999") ||
        b.progress - a.progress,
    )[0] ?? null
  );
}

/** Average of the most recent `n` bills, or null with none logged. */
export function averageBill(bills: Bill[], n = 6): number | null {
  const recent = bills.slice(0, n);
  if (recent.length === 0) return null;
  return Math.round(recent.reduce((a, b) => a + b.amount, 0) / recent.length);
}

/** The unpaid bill due soonest. */
export function nextUnpaid(bills: Bill[]): Bill | null {
  return (
    bills
      .filter((b) => !b.paid && b.amount > 0)
      .sort((a, b) =>
        (a.dueDate ?? a.month).localeCompare(b.dueDate ?? b.month),
      )[0] ?? null
  );
}
