// Credit card milestones: which period counts now, how much is spent in it,
// and the pace needed to hit the target. Pure functions; "today" is passed in.
//
// Spend toward a milestone is the card's logged bills in the period, plus any
// spend not on a bill yet that the person typed in for the card ("unbilled").
// Unbilled spend stops counting once a later bill is logged, since that bill
// now includes it.

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
  createdAt: string;
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
  /** Spend categories this card suits (keys of SPEND_CATEGORIES). */
  bestFor: string[];
  milestones: Milestone[];
  /** Newest month first. */
  bills: Bill[];
  /** Spend since the last logged bill, typed in by the person. */
  unbilled: number;
  unbilledAsOf: string | null;
  /**
   * EMIs of loans on this card, included in each bill. Banks usually leave
   * them out of milestone spend, so they're taken off each bill here.
   */
  emiPerBill?: number;
}

/** What a milestone needs from its card to count spend. */
export type CardSpend = Pick<
  Card,
  "yearStart" | "bills" | "unbilled" | "unbilledAsOf" | "emiPerBill"
>;

/** First day of the month after an ISO month. */
const nextMonth = (isoMonth: string) => {
  const [y, m] = isoMonth.split("-").map(Number);
  return m === 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, "0")}-01`;
};

/**
 * Unbilled spend that still counts: typed after the latest logged bill's
 * month, so a newer bill hasn't already included it.
 */
export function liveUnbilled(
  card: Pick<Card, "bills" | "unbilled" | "unbilledAsOf">,
): number {
  if (!card.unbilled || !card.unbilledAsOf) return 0;
  const latest = card.bills.reduce<string | null>(
    (a, b) => (!a || b.month > a ? b.month : a),
    null,
  );
  return !latest || card.unbilledAsOf >= nextMonth(latest) ? card.unbilled : 0;
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
  /** Spend counted in this period: bills plus unbilled. */
  spentNow: number;
  /** From logged bills in this period. */
  billed: number;
  /** How many bills were counted. */
  billCount: number;
  /** Unbilled spend that counts here. */
  unbilledNow: number;
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

/** First day of the month an ISO date falls in. */
const monthOf = (isoDate: string) => `${isoDate.slice(0, 7)}-01`;

/**
 * Bills that count toward a period: statement months from the month the
 * period starts in, up to its end.
 */
export function billsInPeriod(
  bills: Bill[],
  start: string,
  end: string | null,
): Bill[] {
  const from = monthOf(start);
  return bills.filter((b) => b.month >= from && (!end || b.month <= end));
}

export function milestoneState(
  m: Milestone,
  todayISO: string,
  card: CardSpend = {
    yearStart: null,
    bills: [],
    unbilled: 0,
    unbilledAsOf: null,
  },
): MilestoneState {
  const { start, end } = periodBounds(
    m.period,
    todayISO,
    card.yearStart,
    m.deadline,
  );
  // A one-off milestone counts from when it was added.
  const from = start ?? m.createdAt.slice(0, 10);
  const counted = billsInPeriod(card.bills, from, end);
  const emi = card.emiPerBill ?? 0;
  const billed = counted.reduce((a, b) => a + Math.max(0, b.amount - emi), 0);
  const live = liveUnbilled(card);
  const unbilledNow = live && card.unbilledAsOf! >= from ? live : 0;
  const spentNow = billed + unbilledNow;
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
    billed,
    billCount: counted.length,
    unbilledNow,
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

/** Display order only: unknown due dates are unpaid, never assumed overdue. */
function billPriority(bill: Bill, today: string): number {
  if (bill.paid || bill.amount <= 0) return 3;
  if (!bill.dueDate) return 2;
  return bill.dueDate < today ? 0 : 1;
}

/** Unpaid bills stay visible even when newer paid statements have been logged. */
export function billsForReview(bills: Bill[], today: string): Bill[] {
  return [...bills].sort((a, b) => {
    const priority = billPriority(a, today) - billPriority(b, today);
    if (priority) return priority;
    if (billPriority(a, today) === 3) return b.month.localeCompare(a.month);
    return (a.dueDate ?? a.month).localeCompare(b.dueDate ?? b.month);
  });
}

/** Cards with overdue bills first, followed by dated, undated and settled bills. */
export function cardsForReview(cards: Card[], today: string): Card[] {
  const rows = cards.map((card, index) => ({
    card,
    index,
    bill: billsForReview(card.bills, today).find(
      (b) => !b.paid && b.amount > 0,
    ),
  }));
  rows.sort((a, b) => {
    const priority =
      (a.bill ? billPriority(a.bill, today) : 3) -
      (b.bill ? billPriority(b.bill, today) : 3);
    if (priority) return priority;
    if (a.bill && b.bill) {
      const due = (a.bill.dueDate ?? a.bill.month).localeCompare(
        b.bill.dueDate ?? b.bill.month,
      );
      if (due) return due;
    }
    return a.index - b.index;
  });
  return rows.map((row) => row.card);
}

/** "due in 2 days", "overdue by 3 days"... for an unpaid bill, with how urgent it is. */
export function dueLabel(
  dueDate: string | null,
  today: string,
): { text: string; tone: "danger" | "warning" | "normal" } {
  if (!dueDate) return { text: "unpaid, due date not set", tone: "normal" };
  const days = Math.round(
    (Date.parse(dueDate) - Date.parse(today)) / (24 * 3600 * 1000),
  );
  if (days < 0)
    return {
      text: `overdue by ${-days} day${days === -1 ? "" : "s"}`,
      tone: "danger",
    };
  if (days === 0) return { text: "due today", tone: "danger" };
  if (days === 1) return { text: "due tomorrow", tone: "warning" };
  if (days <= 7)
    return {
      text: `due in ${days} days`,
      tone: days <= 3 ? "warning" : "normal",
    };
  const [, m, d] = dueDate.split("-").map(Number);
  return {
    text: `due ${d} ${"Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")[m - 1]}`,
    tone: "normal",
  };
}
