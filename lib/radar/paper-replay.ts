import { candleSchema, type Candle } from "./contracts";

export interface PaperSignal {
  session: string;
  availableAt: string;
  decision: "Buy candidate" | "Wait";
}
export interface ReplayRow {
  strategy: "model" | "monthly" | "immediate" | "simple-dip";
  contributed: number;
  finalValue: number;
  cash: number;
  fees: number;
  purchases: number;
  profit: number;
  /** Unitised equity removes contributions before measuring drawdown. */
  maxDrawdownPct: number;
  averageCashPct: number;
}

/** Research harness only. Same cash availability, next-session execution, explicit costs, no parameter search. */
export function replayResearch({ candles, signals, initialCash, monthlyCash, monthlyDay = 15, costBps = 20 }: {
  candles: Candle[];
  signals: PaperSignal[];
  initialCash: number;
  monthlyCash: number;
  monthlyDay?: number;
  costBps?: number;
}): ReplayRow[] {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (candles.length < 2 || candles.length > 5000 ||
    candles.some((c, i) => !candleSchema.safeParse(c).success || !validDate(c.date) || (i > 0 && c.date <= candles[i - 1].date)))
    throw new Error("Replay requires ordered, unique, valid sessions.");
  if (![initialCash, monthlyCash].every((v) => Number.isSafeInteger(v) && v >= 0) || initialCash <= 0 ||
    !Number.isInteger(monthlyDay) || monthlyDay < 1 || monthlyDay > 28 ||
    !Number.isFinite(costBps) || costBps < 0 || costBps > 100)
    throw new Error("Check replay cash amounts, monthly date and costs.");
  const byDate = new Map<string, PaperSignal>();
  const sessions = new Set(candles.map((c) => c.date));
  for (const signal of signals) {
    if (!sessions.has(signal.session) || byDate.has(signal.session) ||
      !["Buy candidate", "Wait"].includes(signal.decision) ||
      !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(signal.availableAt) ||
      !Number.isFinite(Date.parse(signal.availableAt)) ||
      Date.parse(signal.availableAt) < Date.parse(`${signal.session}T15:30:00+05:30`))
      throw new Error("Signals require a unique session and actual availability after its close.");
    byDate.set(signal.session, signal);
  }
  const strategies = ["model", "monthly", "immediate", "simple-dip"] as const;
  return strategies.map((strategy): ReplayRow => {
    let cash = initialCash, units = 0, contributed = initialCash, fees = 0, purchases = 0;
    let previousEquity = initialCash, index = 1, peak = 1, maxDrawdownPct = 0, cashSum = 0;
    let boughtMonth = "";
    for (let i = 0; i < candles.length; i++) {
      const bar = candles[i], month = bar.date.slice(0, 7);
      const inflow = i > 0 && month !== candles[i - 1].date.slice(0, 7) ? monthlyCash : 0;
      // Overnight price changes occur before the cash arrives at this session's open.
      const beforeInflow = cash + units * bar.open;
      index *= beforeInflow / previousEquity;
      const startEquity = beforeInflow + inflow;
      cash += inflow;
      contributed += inflow;
      const prior = i ? candles[i - 1] : null;
      const signal = prior ? byDate.get(prior.date) : undefined;
      // NAV published later than the next open cannot be used for that open.
      const available = signal && Date.parse(signal.availableAt) < Date.parse(`${bar.date}T09:15:00+05:30`);
      const monthlyDue = Number(bar.date.slice(8)) >= monthlyDay && boughtMonth !== month;
      const peak90 = i >= 90 ? Math.max(...candles.slice(i - 90, i).map((c) => c.close)) : null;
      const dipDue = prior && peak90 !== null && prior.close / peak90 - 1 <= -0.05;
      const fraction = strategy === "immediate" ? 1 :
        strategy === "monthly" && monthlyDue ? 1 :
        strategy === "model" && available && signal.decision === "Buy candidate" ? 0.25 :
        strategy === "simple-dip" && dipDue ? 0.25 : 0;
      const budget = cash * fraction;
      if (budget > 0) {
        const notional = budget / (1 + costBps / 10000);
        units += notional / bar.open;
        fees += budget - notional;
        cash -= budget;
        purchases++;
        if (strategy === "monthly") boughtMonth = month;
      }
      const equity = cash + units * bar.close;
      // Remove the external cash flow, preserving overnight and intraday performance.
      index *= equity / startEquity;
      peak = Math.max(peak, index);
      maxDrawdownPct = Math.max(maxDrawdownPct, (1 - index / peak) * 100);
      cashSum += cash / equity * 100;
      previousEquity = equity;
    }
    return { strategy, contributed, finalValue: previousEquity, cash, fees, purchases,
      profit: previousEquity - contributed, maxDrawdownPct, averageCashPct: cashSum / candles.length };
  });
}
