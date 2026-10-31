// Loans tracked on their own: how much is repaid, the next EMI and whether
// it's paid, and totals across loans. Pure functions; "today" is passed in.

import {
  addMonths,
  emisBetween,
  lastEmiOnOrBefore,
  nextEmiAfter,
  parseISODate,
} from "./dates";
import {
  balanceAfter,
  loanState,
  type LoanInput,
  type LoanState,
} from "./loan";

export const LOAN_TYPES = [
  { value: "home", label: "Home loan" },
  { value: "personal", label: "Personal loan" },
  { value: "car", label: "Car or bike loan" },
  { value: "education", label: "Education loan" },
  { value: "gold", label: "Gold loan" },
  { value: "card", label: "Loan on a card" },
  { value: "other", label: "Other loan" },
] as const;
export type LoanType = (typeof LOAN_TYPES)[number]["value"];

export const loanTypeLabel = (t: string) =>
  LOAN_TYPES.find((x) => x.value === t)?.label ?? "Loan";

export interface LoanPayment {
  dueDate: string;
  amount: number;
  paidOn: string;
}

export interface Loan {
  id: string;
  name: string;
  type: LoanType;
  cardId: string | null;
  /** Amount withdrawn (borrowed), when known. */
  principal: number | null;
  takenOn: string | null;
  ratePct: number;
  emi: number | null;
  monthsLeft: number | null;
  totalEmis: number | null;
  emiDay: number | null;
  /** For a loan on a card: the day the card's bill is generated. */
  billDay: number | null;
  firstEmi: string | null;
  /** Owed on `asOf`. */
  outstanding: number;
  asOf: string;
  foreclosurePct: number | null;
  foreclosureGst: boolean;
  payments: LoanPayment[];
  /** The goal saving to close it early, if any. */
  goal: { id: string; name: string } | null;
}

/** The shape the loan maths (and goals) use. */
export function loanInput(l: Loan): LoanInput {
  return {
    outstanding: l.outstanding,
    emi: l.emi,
    ratePct: l.ratePct,
    monthsLeft: l.monthsLeft,
    asOf: l.asOf,
    emiDay: l.emiDay,
    firstEmi: l.firstEmi,
    foreclosurePct: l.foreclosurePct,
    foreclosureGst: l.foreclosureGst,
  };
}

export interface NextEmi {
  date: string;
  amount: number;
  /** "due in 3 days", "overdue by 2 days"... */
  label: string;
  tone: "danger" | "warning" | "normal";
}

export interface LoanView {
  loan: Loan;
  state: LoanState;
  /** Paid back so far, when the amount withdrawn is known. */
  repaid: number | null;
  /** Share repaid, 0 to 1 (by amount, or by EMIs when that's all we know). */
  progress: number;
  /** "14 of 36 EMIs paid", "22 EMIs left"... */
  emisLine: string | null;
  next: NextEmi | null;
  closed: boolean;
}

/** An EMI that fell due this long ago and isn't marked paid still asks to be. */
const RECENT_DAYS = 7;

const days = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / (24 * 3600 * 1000));

function labelFor(
  date: string,
  today: string,
): Omit<NextEmi, "date" | "amount"> {
  const d = days(today, date);
  if (d < 0)
    return {
      label: `overdue by ${-d} day${d === -1 ? "" : "s"}`,
      tone: "danger",
    };
  if (d === 0) return { label: "due today", tone: "danger" };
  if (d === 1) return { label: "due tomorrow", tone: "warning" };
  if (d <= 7)
    return { label: `due in ${d} days`, tone: d <= 3 ? "warning" : "normal" };
  const { d: day, m } = parseISODate(date);
  return {
    label: `due ${day} ${"Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")[m - 1]}`,
    tone: "normal",
  };
}

/**
 * The EMI to show next. A recent one (last 7 days) not marked paid comes
 * first; older ones are taken as paid, like the balance already assumes.
 */
export function nextEmi(
  l: Loan,
  state: LoanState,
  today: string,
): NextEmi | null {
  if (state.balance <= 0 || state.emi <= 0) return null;
  const paid = new Set(l.payments.map((p) => p.dueDate));
  const recent = lastEmiOnOrBefore(today, state.emiDay);
  const date =
    recent > l.asOf && !paid.has(recent) && days(recent, today) <= RECENT_DAYS
      ? recent
      : nextEmiAfter(l.asOf > today ? l.asOf : today, state.emiDay);
  return { date, amount: state.emi, ...labelFor(date, today) };
}

export function loanView(l: Loan, today: string): LoanView {
  const state = loanState(loanInput(l), today);
  const closed = state.balance <= 0;
  const repaid =
    l.principal && l.principal > 0
      ? Math.max(0, Math.min(l.principal, l.principal - state.balance))
      : null;
  let progress = repaid !== null && l.principal ? repaid / l.principal : 0;
  let emisLine: string | null = null;
  if (l.totalEmis && state.monthsLeft !== null) {
    const done = Math.max(
      0,
      Math.min(l.totalEmis, l.totalEmis - state.monthsLeft),
    );
    emisLine = `${done} of ${l.totalEmis} EMIs paid`;
    if (repaid === null) progress = done / l.totalEmis;
  } else if (state.monthsLeft !== null && !closed) {
    emisLine = `${state.monthsLeft} EMI${state.monthsLeft === 1 ? "" : "s"} left`;
  }
  return {
    loan: l,
    state,
    repaid,
    progress: closed ? 1 : progress,
    emisLine,
    next: closed ? null : nextEmi(l, state, today),
    closed,
  };
}

/**
 * Marking an EMI paid: the loan's balance after that EMI, from that date.
 * Returns the new outstanding and as-of date to save.
 */
export function afterPayment(
  l: Loan,
  dueDate: string,
): { outstanding: number; asOf: string } {
  const input = loanInput(l);
  const emiDay = l.emiDay ?? parseISODate(l.asOf).d;
  const state = loanState(input, l.asOf);
  if (dueDate <= l.asOf) return { outstanding: l.outstanding, asOf: l.asOf };
  const k = emisBetween(l.asOf, dueDate, emiDay);
  return {
    outstanding: Math.round(
      balanceAfter(l.outstanding, l.ratePct, state.emi, k),
    ),
    asOf: dueDate,
  };
}

/** What the loan would owe today if it started from the amount withdrawn. */
export function owedFromStart(
  principal: number,
  ratePct: number,
  emi: number,
  firstEmi: string,
  today: string,
): number {
  const day = parseISODate(firstEmi).d;
  const k = emisBetween(addMonths(firstEmi, -1), today, day);
  return Math.round(balanceAfter(principal, ratePct, emi, k));
}

export interface LoanTotals {
  owed: number;
  monthlyEmi: number;
  /** When the last active loan ends at its EMI. */
  debtFree: string | null;
  /** Some loan's EMI never clears it, so there's no end date. */
  openEnded: boolean;
}

export function loanTotals(views: LoanView[]): LoanTotals {
  const active = views.filter((v) => !v.closed);
  const ends = active.map((v) => v.state.endDate);
  return {
    owed: active.reduce((s, v) => s + v.state.balance, 0),
    monthlyEmi: active.reduce((s, v) => s + v.state.emi, 0),
    debtFree:
      ends.length && ends.every(Boolean)
        ? (ends as string[]).sort().at(-1)!
        : null,
    openEnded: ends.some((e) => !e),
  };
}

/** EMIs on a card each month, from its active loans (left out of milestone spend). */
export function cardEmis(loans: Loan[], cardId: string, today: string): number {
  return loans
    .filter((l) => l.type === "card" && l.cardId === cardId)
    .map((l) => loanState(loanInput(l), today))
    .filter((s) => s.balance > 0)
    .reduce((s, st) => s + st.emi, 0);
}
