// Bills fund: one pot saving for known payments that come round on a cycle
// (insurance, gym, servicing). Pure functions; callers pass "today" in.

import { addMonths, monthsBetween } from "./dates";

export interface Bill {
  id?: string;
  name: string;
  amount: number;
  /** Paid every this many months (1 monthly, 12 yearly); 0 means once. */
  everyMonths: number;
  /** Next due date as stored; rolled forward here once it passes. */
  nextDue: string;
}

export interface BillEvent {
  name: string;
  amount: number;
  date: string;
  /** Whether the fund will have enough on that date at the current SIP. */
  covered: boolean;
}

export interface BillsFundState {
  /** Bills with their due dates rolled forward to today or later. */
  bills: (Bill & { due: string })[];
  /**
   * What to put in each month: enough to pay everything due in the next year
   * given what's already in the fund, and never less than the steady amount
   * repeating bills need.
   */
  monthlyNeed: number;
  /** What the fund should hold today if repeating bills had been filled steadily. */
  shouldHold: number;
  /**
   * What the fund needs today: the balance plus any shortfall at the current
   * SIP, or `shouldHold` when nothing is short.
   */
  needsToday: number;
  /** One-off amount to add now so every payment in the next year is covered at the current SIP. */
  topUpNow: number;
  /** Total short at the current SIP, and the date the gap is deepest. */
  short: { amount: number; by: string } | null;
  /** Payments in the next 12 months, soonest first. */
  upcoming: BillEvent[];
  /** First payment the fund can't cover at the current SIP, if any. */
  firstShort: (BillEvent & { shortBy: number }) | null;
}

/** The next due date on or after today. A one-off keeps its own date. */
export function rollForward(
  nextDue: string,
  everyMonths: number,
  todayISO: string,
): string {
  if (everyMonths === 0) return nextDue;
  let d = nextDue;
  let guard = 0;
  while (d < todayISO && guard++ < 1000) d = addMonths(d, everyMonths);
  return d;
}

/** Every payment due after today (inclusive) and within `months`. */
function events(
  bills: (Bill & { due: string })[],
  todayISO: string,
  months: number,
) {
  const end = addMonths(todayISO, months);
  const out: { name: string; amount: number; date: string }[] = [];
  for (const b of bills) {
    if (b.everyMonths === 0) {
      if (b.due >= todayISO && b.due < end)
        out.push({ name: b.name, amount: b.amount, date: b.due });
      continue;
    }
    for (let d = b.due; d < end; d = addMonths(d, b.everyMonths))
      out.push({ name: b.name, amount: b.amount, date: d });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Walks the next year: the fund's balance, a monthly deposit on the 1st of
 * each coming month, and each bill on its date. Returns the lowest balance
 * reached and the first payment that would take it below zero.
 */
function simulate(
  start: number,
  monthly: number,
  evts: { name: string; amount: number; date: string }[],
  todayISO: string,
) {
  let balance = start;
  let low = start;
  let lowDate: string | null = null;
  let firstShort: { index: number; shortBy: number } | null = null;
  const covered: boolean[] = [];
  let depositOn = addMonths(`${todayISO.slice(0, 7)}-01`, 1);
  evts.forEach((e, i) => {
    while (depositOn <= e.date) {
      balance += monthly;
      depositOn = addMonths(depositOn, 1);
    }
    balance -= e.amount;
    covered.push(balance >= 0);
    if (balance < 0 && !firstShort)
      firstShort = { index: i, shortBy: Math.ceil(-balance) };
    if (balance < low) {
      low = balance;
      lowDate = e.date;
    }
  });
  return {
    low,
    lowDate,
    covered,
    firstShort: firstShort as { index: number; shortBy: number } | null,
  };
}

/**
 * The least to put in each month so every payment in the next year is met
 * from `balance` plus the deposits, and at least the steady amount that
 * repeating bills need. Payments due before the first deposit can't be
 * helped by a monthly amount; those need a top-up.
 */
export function monthlyToCover(
  bills: (Bill & { due: string })[],
  evts: { name: string; amount: number; date: string }[],
  balance: number,
  todayISO: string,
): number {
  const steady = bills.reduce(
    (s, b) => (b.everyMonths > 0 ? s + b.amount / b.everyMonths : s),
    0,
  );
  const total = evts.reduce((s, e) => s + e.amount, 0);
  const best = Math.min(0, simulate(balance, total, evts, todayISO).low);
  let lo = 0;
  let hi = Math.ceil(total);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (simulate(balance, mid, evts, todayISO).low >= best - 0.5) hi = mid;
    else lo = mid + 1;
  }
  return Math.ceil(Math.max(lo, steady));
}

/** What to put in each month for these bills, starting from `balance`. */
export function billsMonthlyNeed(
  input: Bill[],
  balance: number,
  todayISO: string,
): number {
  const bills = input
    .map((b) => ({
      ...b,
      due: rollForward(b.nextDue, b.everyMonths, todayISO),
    }))
    .filter((b) => b.due >= todayISO);
  return monthlyToCover(bills, events(bills, todayISO, 12), balance, todayISO);
}

export function billsFundState(
  input: Bill[],
  balance: number,
  monthlySip: number,
  todayISO: string,
): BillsFundState {
  // One-off payments whose date has passed are done and drop out.
  const bills = input
    .map((b) => ({
      ...b,
      due: rollForward(b.nextDue, b.everyMonths, todayISO),
    }))
    .filter((b) => b.due >= todayISO)
    .sort((a, b) => a.due.localeCompare(b.due));
  const evts = events(bills, todayISO, 12);
  const monthlyNeed = monthlyToCover(bills, evts, balance, todayISO);
  // Repeating bills build up steadily from their last payment to the next.
  // (One-off payments have no cycle; they show up in the shortfall instead.)
  const shouldHold = Math.round(
    bills.reduce((s, b) => {
      if (b.everyMonths === 0) return s;
      const monthsLeft = Math.min(
        b.everyMonths,
        monthsBetween(todayISO, b.due),
      );
      return s + (b.amount * (b.everyMonths - monthsLeft)) / b.everyMonths;
    }, 0),
  );

  const atSip = simulate(balance, monthlySip, evts, todayISO);
  const upcoming = evts.map((e, i) => ({ ...e, covered: atSip.covered[i] }));
  const topUpNow = Math.max(0, Math.ceil(-atSip.low));

  return {
    bills,
    monthlyNeed,
    shouldHold,
    needsToday: topUpNow > 0 ? balance + topUpNow : shouldHold,
    topUpNow,
    short:
      topUpNow > 0 && atSip.lowDate
        ? { amount: topUpNow, by: atSip.lowDate }
        : null,
    upcoming,
    firstShort: atSip.firstShort
      ? {
          ...upcoming[atSip.firstShort.index],
          shortBy: atSip.firstShort.shortBy,
        }
      : null,
  };
}
