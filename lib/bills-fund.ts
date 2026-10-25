// Bills fund: one pot saving for known payments that come round on a cycle
// (insurance, gym, servicing). Pure functions; callers pass "today" in.

import { addMonths, monthsBetween } from "./dates";

export interface Bill {
  id?: string;
  name: string;
  amount: number;
  /** Paid every this many months (1 monthly, 12 yearly). */
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
  /** Spread over each bill's cycle, the amount to put in each month. */
  monthlyNeed: number;
  /** What the fund should hold today if it had been filled steadily. */
  shouldHold: number;
  /** One-off amount to add now so every bill in the next year is covered at `monthlyNeed`. */
  topUpNow: number;
  /** Payments in the next 12 months, soonest first. */
  upcoming: BillEvent[];
  /** First payment the fund can't cover at the current SIP, if any. */
  firstShort: (BillEvent & { shortBy: number }) | null;
}

/** The next due date on or after today. */
export function rollForward(nextDue: string, everyMonths: number, todayISO: string): string {
  let d = nextDue;
  let guard = 0;
  while (d < todayISO && guard++ < 1000) d = addMonths(d, everyMonths);
  return d;
}

/** Every payment due after today (inclusive) and within `months`. */
function events(bills: (Bill & { due: string })[], todayISO: string, months: number) {
  const end = addMonths(todayISO, months);
  const out: { name: string; amount: number; date: string }[] = [];
  for (const b of bills) {
    for (let d = b.due; d < end; d = addMonths(d, b.everyMonths)) out.push({ name: b.name, amount: b.amount, date: d });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Walks the next year: the fund's balance, a monthly deposit on the 1st of
 * each coming month, and each bill on its date. Returns the lowest balance
 * reached and the first payment that would take it below zero.
 */
function simulate(start: number, monthly: number, evts: { name: string; amount: number; date: string }[], todayISO: string) {
  let balance = start;
  let low = start;
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
    if (balance < 0 && !firstShort) firstShort = { index: i, shortBy: Math.ceil(-balance) };
    low = Math.min(low, balance);
  });
  return { low, covered, firstShort: firstShort as { index: number; shortBy: number } | null };
}

export function billsFundState(input: Bill[], balance: number, monthlySip: number, todayISO: string): BillsFundState {
  const bills = input
    .map((b) => ({ ...b, due: rollForward(b.nextDue, b.everyMonths, todayISO) }))
    .sort((a, b) => a.due.localeCompare(b.due));
  const monthlyNeed = Math.ceil(bills.reduce((s, b) => s + b.amount / b.everyMonths, 0));
  // Each bill builds up steadily from its last payment to its next one.
  const shouldHold = Math.round(
    bills.reduce((s, b) => {
      const monthsLeft = Math.min(b.everyMonths, monthsBetween(todayISO, b.due));
      return s + (b.amount * (b.everyMonths - monthsLeft)) / b.everyMonths;
    }, 0),
  );

  const evts = events(bills, todayISO, 12);
  const atNeed = simulate(balance, monthlyNeed, evts, todayISO);
  const atSip = simulate(balance, monthlySip, evts, todayISO);
  const upcoming = evts.map((e, i) => ({ ...e, covered: atSip.covered[i] }));

  return {
    bills,
    monthlyNeed,
    shouldHold,
    topUpNow: Math.max(0, Math.ceil(-atNeed.low)),
    upcoming,
    firstShort: atSip.firstShort ? { ...upcoming[atSip.firstShort.index], shortBy: atSip.firstShort.shortBy } : null,
  };
}
