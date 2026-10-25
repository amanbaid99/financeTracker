// Loan maths for EMI loans: balance after each EMI, months left, interest vs principal.
// Pure functions; rates are % a year, EMIs paid monthly.

import { addMonths, monthsBetween } from "./dates";

const monthly = (ratePct: number) => ratePct / 100 / 12;

/** Balance left after `k` EMIs. */
export function balanceAfter(
  balance: number,
  ratePct: number,
  emi: number,
  k: number,
): number {
  if (k <= 0) return balance;
  const r = monthly(ratePct);
  if (r === 0) return Math.max(0, balance - emi * k);
  const g = Math.pow(1 + r, k);
  return Math.max(0, balance * g - (emi * (g - 1)) / r);
}

/** EMIs still to pay, or null if the EMI doesn't even cover the interest. */
export function monthsToClose(
  balance: number,
  ratePct: number,
  emi: number,
): number | null {
  if (balance <= 0) return 0;
  if (emi <= 0) return null;
  const r = monthly(ratePct);
  if (r === 0) return Math.ceil(balance / emi);
  if (emi <= balance * r) return null;
  return Math.ceil(-Math.log(1 - (r * balance) / emi) / Math.log(1 + r) - 1e-9);
}

/** EMI that clears `balance` in `months`. */
export function emiFor(
  balance: number,
  ratePct: number,
  months: number,
): number {
  if (months <= 0) return balance;
  const r = monthly(ratePct);
  if (r === 0) return Math.ceil(balance / months);
  const g = Math.pow(1 + r, months);
  return Math.ceil((balance * r * g) / (g - 1));
}

export interface LoanInput {
  /** Outstanding on `asOf`. */
  outstanding: number;
  emi: number | null;
  ratePct: number;
  /** EMIs left on `asOf`, used when the EMI isn't given. */
  monthsLeft: number | null;
  asOf: string;
  /** Foreclosure charge, % of the amount owed when you close. */
  foreclosurePct?: number | null;
  /** 18% GST charged on top of the foreclosure charge. */
  foreclosureGst?: boolean;
}

export const GST_RATE = 0.18;

/** Foreclosure cost as a share of the amount owed, GST included. */
export function foreclosureRate(
  input: Pick<LoanInput, "foreclosurePct" | "foreclosureGst">,
): number {
  const pct = input.foreclosurePct ?? 0;
  return (pct / 100) * (input.foreclosureGst ? 1 + GST_RATE : 1);
}

export interface LoanState {
  /** Outstanding today, after the EMIs paid since `asOf`. */
  balance: number;
  emi: number;
  ratePct: number;
  /** EMIs left from today; null if the EMI never clears it. */
  monthsLeft: number | null;
  interestThisMonth: number;
  principalThisMonth: number;
  /** When the last EMI is due, at the current EMI. */
  endDate: string | null;
  /** Interest still to pay if you just keep paying EMIs. */
  interestLeft: number | null;
  /** Foreclosure cost as a share of the amount owed (GST included). */
  feeRate: number;
  /** What closing today would cost in foreclosure charges. */
  feeToday: number;
}

export function loanState(input: LoanInput, todayISO: string): LoanState {
  const emi =
    input.emi ??
    (input.monthsLeft
      ? emiFor(input.outstanding, input.ratePct, input.monthsLeft)
      : 0);
  const paid = monthsBetween(input.asOf, todayISO);
  const balance = Math.round(
    balanceAfter(input.outstanding, input.ratePct, emi, paid),
  );
  const monthsLeft = monthsToClose(balance, input.ratePct, emi);
  const interestThisMonth = Math.round(balance * monthly(input.ratePct));
  return {
    balance,
    emi,
    ratePct: input.ratePct,
    monthsLeft,
    interestThisMonth: balance > 0 ? interestThisMonth : 0,
    principalThisMonth:
      balance > 0 ? Math.max(0, Math.min(balance, emi - interestThisMonth)) : 0,
    endDate: monthsLeft === null ? null : addMonths(todayISO, monthsLeft),
    feeRate: foreclosureRate(input),
    feeToday: Math.round(balance * foreclosureRate(input)),
    interestLeft:
      monthsLeft === null
        ? null
        : Math.max(
            0,
            Math.round(
              lastPaymentsTotal(balance, input.ratePct, emi, monthsLeft) -
                balance,
            ),
          ),
  };
}

/** Total paid over the remaining EMIs (the last one is usually smaller). */
function lastPaymentsTotal(
  balance: number,
  ratePct: number,
  emi: number,
  months: number,
): number {
  if (months <= 0) return 0;
  const before = balanceAfter(balance, ratePct, emi, months - 1);
  return emi * (months - 1) + before * (1 + monthly(ratePct));
}

/** Interest avoided by paying off the balance after `k` EMIs instead of running the loan to term. */
export function interestSavedIfClosedAt(state: LoanState, k: number): number {
  if (state.monthsLeft === null || k >= state.monthsLeft) return 0;
  const rest = balanceAfter(state.balance, state.ratePct, state.emi, k);
  const remainingPaid = lastPaymentsTotal(
    rest,
    state.ratePct,
    state.emi,
    state.monthsLeft - k,
  );
  return Math.max(0, Math.round(remainingPaid - rest));
}
