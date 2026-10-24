// Debt payoff planning: order debts (snowball or avalanche) and simulate
// month by month how long each takes to clear. Pure functions.

import type { EngineConfig } from "./config";
import { addMonths } from "./dates";
import type { Liability } from "./types";

export type DebtMethod = "snowball" | "avalanche";

export function rateFor(l: Liability, cfg: EngineConfig): number {
  if (l.interestRate !== null && l.interestRate !== undefined) return l.interestRate;
  return cfg.ladder.assumedDebtRates[l.kind] ?? 0;
}

/** Snowball: smallest balance first. Avalanche: highest rate first. */
export function orderDebts(debts: Liability[], method: DebtMethod, cfg: EngineConfig): Liability[] {
  return [...debts].sort((a, b) =>
    method === "snowball"
      ? a.outstanding - b.outstanding || rateFor(b, cfg) - rateFor(a, cfg)
      : rateFor(b, cfg) - rateFor(a, cfg) || a.outstanding - b.outstanding,
  );
}

export interface DebtPayoffRow {
  id: string;
  label: string | null;
  kind: Liability["kind"];
  balance: number;
  ratePct: number;
  rateAssumed: boolean;
  emi: number;
  /** Gets extra payments, in this order. Low-rate loans only get their EMI. */
  costly: boolean;
  order: number;
  clearedInMonths: number | null;
  clearDate: string | null;
}

export interface DebtPayoffPlan {
  method: DebtMethod;
  extraMonthly: number;
  rows: DebtPayoffRow[];
  /** Months until every costly debt is cleared, or null if it never is. */
  costlyFreeInMonths: number | null;
  totalInterest: number;
}

/**
 * Each month: interest accrues, every debt gets its EMI (or a card's minimum),
 * then the extra money plus EMIs freed by cleared costly debts goes to the
 * first costly debt still open (the snowball). Low-rate loans ride their EMIs.
 */
export function simulatePayoff(opts: {
  debts: Liability[];
  isCostly: (l: Liability) => boolean;
  extraMonthly: number;
  method: DebtMethod;
  todayISO: string;
  cfg: EngineConfig;
  maxMonths?: number;
}): DebtPayoffPlan {
  const { cfg } = opts;
  const max = opts.maxMonths ?? 600;
  const open = opts.debts.filter((d) => d.outstanding > 0);
  const ordered = [...orderDebts(open.filter(opts.isCostly), opts.method, cfg), ...open.filter((d) => !opts.isCostly(d))];
  const state = ordered.map((d, i) => ({
    d,
    order: i + 1,
    costly: opts.isCostly(d),
    bal: d.outstanding,
    rate: rateFor(d, cfg) / 100 / 12,
    emi: d.emi ?? 0,
    cleared: null as number | null,
  }));
  let freed = 0;
  let totalInterest = 0;

  for (let month = 1; month <= max && state.some((s) => s.cleared === null); month++) {
    let progress = false;
    for (const s of state) {
      if (s.cleared !== null) continue;
      const interest = s.bal * s.rate;
      s.bal += interest;
      totalInterest += interest;
      const min = s.emi > 0 ? s.emi : s.d.kind === "credit_card" ? Math.max(500, s.bal * cfg.ladder.cardMinPaymentPct) : 0;
      const pay = Math.min(s.bal, min);
      if (pay > interest) progress = true;
      s.bal -= pay;
    }
    let pool = Math.max(0, opts.extraMonthly) + freed;
    for (const s of state) {
      if (pool <= 0) break;
      if (s.cleared !== null || !s.costly) continue;
      const pay = Math.min(s.bal, pool);
      if (pay > 0) progress = true;
      s.bal -= pay;
      pool -= pay;
    }
    for (const s of state) {
      if (s.cleared === null && s.bal <= 0.5) {
        s.cleared = month;
        if (s.costly) freed += s.emi;
      }
    }
    if (!progress) break;
  }

  const costly = state.filter((s) => s.costly);
  return {
    method: opts.method,
    extraMonthly: Math.max(0, Math.round(opts.extraMonthly)),
    rows: state.map((s) => ({
      id: s.d.id,
      label: s.d.label ?? null,
      kind: s.d.kind,
      balance: s.d.outstanding,
      ratePct: rateFor(s.d, cfg),
      rateAssumed: s.d.interestRate === null || s.d.interestRate === undefined,
      emi: s.emi,
      costly: s.costly,
      order: s.order,
      clearedInMonths: s.cleared,
      clearDate: s.cleared === null ? null : addMonths(opts.todayISO, s.cleared),
    })),
    costlyFreeInMonths:
      costly.length === 0 ? 0 : costly.every((s) => s.cleared !== null) ? Math.max(...costly.map((s) => s.cleared!)) : null,
    totalInterest: Math.round(totalInterest),
  };
}
