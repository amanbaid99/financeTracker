// Goal tracking: how much each goal has, where it's heading and what it needs.
// Pure functions; callers pass "today" in.

import { addMonths, emisBetween, monthsBetween } from "./dates";
import { billsFundState, type Bill, type BillsFundState } from "./bills-fund";
import { defaultReturn } from "./instruments";
import {
  balanceAfter,
  interestSavedIfClosedAt,
  loanState,
  type LoanInput,
  type LoanState,
} from "./loan";

export interface Investment {
  id: string;
  kind: string;
  name: string | null;
  category: string | null;
  value: number;
  monthlySip: number;
  /** User's own return %, or null for the type's default. */
  returnPct: number | null;
  /** Amount put in (cost), when known. */
  invested?: number | null;
}

export interface GoalInput {
  id: string;
  name: string;
  type: string;
  target: number;
  /** yyyy-mm-dd, or null for no fixed date. */
  targetDate: string | null;
  /** % a year to grow the target by, or null for none. */
  inflationPct: number | null;
  /** For loan payoff goals. */
  loan?: LoanInput | null;
  /** For bills fund goals: the payments it saves for. */
  bills?: Bill[] | null;
}

export interface Link {
  goalId: string;
  investmentId: string;
  /** Share of the investment that belongs to this goal, 0 to 100. */
  percent: number;
}

export type GoalStatus =
  | "reached"
  | "on_track"
  | "behind"
  | "no_investments"
  | "overdue";

export interface GoalLine {
  investment: Investment;
  percent: number;
  /** This goal's share of the value and SIP. */
  value: number;
  monthlySip: number;
  returnPct: number;
}

export interface TrackedGoal extends GoalInput {
  lines: GoalLine[];
  current: number;
  monthlySip: number;
  /** Blended planning return, % a year. */
  returnPct: number;
  /** Amount needed on the target date (after inflation; for loans, what's still owed then). */
  futureTarget: number;
  progress: number;
  months: number | null;
  /** Value expected on the target date at the current pace. */
  projected: number | null;
  /** Extra SIP a month needed to reach the target on time. */
  extraSipNeeded: number;
  /** For goals with no date: months until reached at this pace (null if never). */
  monthsToReach: number | null;
  reachDate: string | null;
  status: GoalStatus;
  /** Loan payoff goals only. */
  loanState: LoanState | null;
  /** Bills fund goals only. */
  billsFund: BillsFundState | null;
  /** Loans: the EMIs alone close it on or before the target. */
  emisCloseFirst: boolean;
  /** Loans: interest avoided by closing on the target date (or reach date). */
  interestSaved: number;
  /** Loans: foreclosure charge (with GST) when you close. */
  foreclosureFee: number;
  /** Loans: interest saved minus the foreclosure charge. */
  netSaving: number;
}

const MAX_MONTHS = 600;

/** Value after `months` with savings growing and a SIP paid at the start of each month. */
export function projectedValue(
  saved: number,
  sip: number,
  annualPct: number,
  months: number,
): number {
  if (months <= 0) return saved;
  const r = annualPct / 100 / 12;
  if (r === 0) return saved + sip * months;
  const g = Math.pow(1 + r, months);
  return saved * g + (sip * (g - 1) * (1 + r)) / r;
}

/** Monthly SIP needed to reach `target` in `months` from `saved`. Zero if already enough. */
export function requiredSip(
  target: number,
  saved: number,
  annualPct: number,
  months: number,
): number {
  if (months <= 0) return Math.max(0, target - saved);
  const r = annualPct / 100 / 12;
  const g = Math.pow(1 + r, months);
  const gap = target - saved * g;
  if (gap <= 0) return 0;
  return r === 0 ? gap / months : (gap * r) / ((g - 1) * (1 + r));
}

/** Months until `target` is reached, or null if not within 50 years. */
export function monthsToReach(
  target: number,
  saved: number,
  sip: number,
  annualPct: number,
): number | null {
  if (saved >= target) return 0;
  for (let m = 1; m <= MAX_MONTHS; m++) {
    if (projectedValue(saved, sip, annualPct, m) >= target) return m;
  }
  return null;
}

function goalLines(
  goal: GoalInput,
  investments: Investment[],
  links: Link[],
): GoalLine[] {
  const byId = new Map(investments.map((i) => [i.id, i]));
  return links
    .filter((l) => l.goalId === goal.id && byId.has(l.investmentId))
    .map((l) => {
      const inv = byId.get(l.investmentId)!;
      const share = l.percent / 100;
      return {
        investment: inv,
        percent: l.percent,
        value: Math.round(inv.value * share),
        monthlySip: Math.round(inv.monthlySip * share),
        returnPct: inv.returnPct ?? defaultReturn(inv.kind, inv.category),
      };
    });
}

function blendedReturn(lines: GoalLine[]): number {
  // Weight by value plus a year of SIPs, so SIP-only funds still count.
  const weight = (l: GoalLine) => l.value + l.monthlySip * 12;
  const total = lines.reduce((s, l) => s + weight(l), 0);
  if (!total) return lines.length ? lines[0].returnPct : 0;
  return (
    Math.round(
      (lines.reduce((s, l) => s + weight(l) * l.returnPct, 0) / total) * 10,
    ) / 10
  );
}

export function trackGoal(
  goal: GoalInput,
  investments: Investment[],
  links: Link[],
  todayISO: string,
): TrackedGoal {
  const lines = goalLines(goal, investments, links);
  const current = lines.reduce((s, l) => s + l.value, 0);
  const monthlySip = lines.reduce((s, l) => s + l.monthlySip, 0);
  const returnPct = blendedReturn(lines);
  const months = goal.targetDate
    ? monthsBetween(todayISO, goal.targetDate)
    : null;
  const base = { ...goal, lines, current, monthlySip, returnPct, months };

  if (goal.type === "loan_payoff" && goal.loan)
    return trackLoan(base, goal.loan, todayISO);
  if (goal.type === "bills_fund") return trackBills(base, goal.bills ?? [], todayISO);

  const futureTarget =
    months !== null && goal.inflationPct
      ? Math.round(
          goal.target * Math.pow(1 + goal.inflationPct / 100, months / 12),
        )
      : goal.target;

  let projected: number | null = null;
  let extraSipNeeded = 0;
  let toReach: number | null = null;
  let status: GoalStatus;

  if (current >= futureTarget) {
    status = "reached";
    toReach = 0;
  } else if (months !== null) {
    projected = Math.round(
      projectedValue(current, monthlySip, returnPct, months),
    );
    extraSipNeeded = Math.max(
      0,
      Math.ceil(
        requiredSip(futureTarget, current, returnPct, months) - monthlySip,
      ),
    );
    if (months === 0) status = "overdue";
    else if (!lines.length) status = "no_investments";
    else status = projected >= futureTarget ? "on_track" : "behind";
  } else {
    toReach = monthsToReach(futureTarget, current, monthlySip, returnPct);
    status = lines.length ? "on_track" : "no_investments";
  }

  return {
    ...base,
    futureTarget,
    progress: futureTarget > 0 ? Math.min(1, current / futureTarget) : 1,
    projected,
    extraSipNeeded,
    monthsToReach: toReach,
    reachDate:
      toReach !== null && months === null ? addMonths(todayISO, toReach) : null,
    status,
    loanState: null,
    billsFund: null,
    emisCloseFirst: false,
    interestSaved: 0,
    foreclosureFee: 0,
    netSaving: 0,
  };
}

/**
 * Saving up to close a loan early. The balance falls with every EMI, so the
 * amount needed is what's still owed on the chosen date.
 */
function trackLoan(
  base: Pick<
    TrackedGoal,
    | keyof GoalInput
    | "lines"
    | "current"
    | "monthlySip"
    | "returnPct"
    | "months"
  >,
  input: LoanInput,
  todayISO: string,
): TrackedGoal {
  const loan = loanState(input, todayISO);
  const { current, monthlySip, returnPct, months, lines } = base;
  // EMIs paid between now and the target date (the balance drops on each).
  const emisToDate = base.targetDate ? emisBetween(todayISO, base.targetDate, loan.emiDay) : null;
  const owedAfter = (k: number) =>
    Math.round(balanceAfter(loan.balance, loan.ratePct, loan.emi, k));
  // Closing costs what's owed plus the foreclosure charge on it.
  const feeAfter = (k: number) => Math.round(owedAfter(k) * loan.feeRate);
  const costAfter = (k: number) => owedAfter(k) + feeAfter(k);
  const savings = (k: number) => {
    const interestSaved =
      k === 0 ? (loan.interestLeft ?? 0) : interestSavedIfClosedAt(loan, k);
    const foreclosureFee = feeAfter(k);
    return {
      interestSaved,
      foreclosureFee,
      netSaving: interestSaved - foreclosureFee,
    };
  };
  const costToday = costAfter(0);
  const done = (extra: Partial<TrackedGoal>): TrackedGoal => ({
    ...base,
    target: costToday,
    futureTarget: costToday,
    progress: costToday > 0 ? Math.min(1, current / costToday) : 1,
    projected: null,
    extraSipNeeded: 0,
    monthsToReach: null,
    reachDate: null,
    status: "on_track",
    loanState: loan,
    billsFund: null,
    emisCloseFirst: false,
    interestSaved: 0,
    foreclosureFee: 0,
    netSaving: 0,
    ...extra,
  });

  if (loan.balance <= 0 || current >= costToday) {
    return done({
      status: "reached",
      monthsToReach: 0,
      progress: 1,
      ...(loan.balance > 0 ? savings(0) : {}),
    });
  }

  if (months !== null) {
    const k = emisToDate ?? months;
    if (loan.monthsLeft !== null && k >= loan.monthsLeft) {
      // The regular EMIs finish before the target date.
      return done({
        emisCloseFirst: true,
        futureTarget: 0,
        progress: 1,
        reachDate: loan.endDate,
      });
    }
    const need = costAfter(k);
    const projected = Math.round(
      projectedValue(current, monthlySip, returnPct, months),
    );
    const status: GoalStatus =
      months === 0
        ? "overdue"
        : !lines.length
          ? "no_investments"
          : projected >= need
            ? "on_track"
            : "behind";
    return done({
      futureTarget: need,
      progress: need > 0 ? Math.min(1, current / need) : 1,
      projected,
      extraSipNeeded: Math.max(
        0,
        Math.ceil(requiredSip(need, current, returnPct, months) - monthlySip),
      ),
      status,
      ...savings(k),
    });
  }

  // No date: the first month your savings catch up with the cost of closing.
  const limit = loan.monthsLeft ?? MAX_MONTHS;
  let reach: number | null = null;
  for (let m = 1; m < limit; m++) {
    if (projectedValue(current, monthlySip, returnPct, m) >= costAfter(m)) {
      reach = m;
      break;
    }
  }
  if (reach === null) {
    return done({
      status: lines.length ? "on_track" : "no_investments",
      emisCloseFirst: loan.monthsLeft !== null,
      reachDate: loan.endDate,
    });
  }
  return done({
    monthsToReach: reach,
    reachDate: addMonths(todayISO, reach),
    status: lines.length ? "on_track" : "no_investments",
    ...savings(reach),
  });
}

/** Share of each investment not yet given to any goal, 0 to 100. */
export function freePercent(
  investmentId: string,
  links: Link[],
  exceptGoalId?: string,
): number {
  const used = links
    .filter((l) => l.investmentId === investmentId && l.goalId !== exceptGoalId)
    .reduce((s, l) => s + l.percent, 0);
  return Math.max(0, Math.round((100 - used) * 100) / 100);
}

/** A bills fund: on track while every payment in the next year is covered. */
function trackBills(
  base: Pick<TrackedGoal, keyof GoalInput | "lines" | "current" | "monthlySip" | "returnPct" | "months">,
  bills: Bill[],
  todayISO: string,
): TrackedGoal {
  const state = billsFundState(bills, base.current, base.monthlySip, todayISO);
  const status: GoalStatus = !bills.length
    ? "no_investments"
    : state.firstShort
      ? "behind"
      : !base.lines.length
        ? "no_investments"
        : "on_track";
  return {
    ...base,
    target: state.shouldHold,
    futureTarget: state.shouldHold,
    progress: state.shouldHold > 0 ? Math.min(1, base.current / state.shouldHold) : bills.length ? 1 : 0,
    projected: null,
    extraSipNeeded: Math.max(0, state.monthlyNeed - base.monthlySip),
    monthsToReach: null,
    reachDate: null,
    status,
    loanState: null,
    billsFund: state,
    emisCloseFirst: false,
    interestSaved: 0,
    foreclosureFee: 0,
    netSaving: 0,
  };
}
