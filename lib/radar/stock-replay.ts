import { candleSchema, type Candle } from "./contracts";
import { evaluateStock, STOCK_MODEL, type StockStudy } from "./stock-model";

export interface StockReplayInput {
  isin: string;
  candles: Candle[];
  adjustmentsVerified: boolean;
  observations: { session: string; assessedAt: string; sources: unknown }[];
  holdoutStart: string;
  horizonSessions: number;
  /** Charged separately on the hypothetical entry and exit, including estimated slippage. */
  costBpsPerSide: number;
}
export interface StockReplayRow {
  session: string;
  partition: "development" | "holdout";
  study: StockStudy;
  outcome: { entrySession: string; exitSession: string; netPriceReturnPct: number } | null;
}
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;

/** Offline forward-outcome audit, not a portfolio backtest, release gate or performance claim. */
export function replayStocks(input: StockReplayInput) {
  const { candles, observations, horizonSessions, costBpsPerSide, holdoutStart } = input;
  if (!validDate(holdoutStart) || !/^IN[A-Z0-9]{10}$/.test(input.isin) ||
    !Number.isInteger(horizonSessions) || horizonSessions < 1 || horizonSessions > 1000 ||
    !Number.isFinite(costBpsPerSide) || costBpsPerSide < 0 || costBpsPerSide > 1000 ||
    candles.length > 10000 || observations.length > 1000 ||
    candles.some((c, i) => !candleSchema.safeParse(c).success || !validDate(c.date) || (i > 0 && c.date <= candles[i - 1].date)))
    throw new Error("Replay needs bounded, ordered prices, valid dates, horizon and explicit costs.");
  const rows: StockReplayRow[] = [];
  for (const [index, observation] of observations.entries()) {
    const { session, assessedAt, sources } = observation;
    const timestamp = Date.parse(assessedAt);
    const assessmentDay = Number.isFinite(timestamp) ? new Date(timestamp + 330 * 60000).toISOString().slice(0, 10) : null;
    if (!validDate(session) || assessmentDay !== session || !/(?:Z|[+-]\d{2}:\d{2})$/.test(assessedAt) ||
      (index > 0 && session <= observations[index - 1].session))
      throw new Error("Observations must be ordered, unique and assessed on their stated session in IST.");
    const priceIndex = candles.findIndex((c) => c.date === session);
    if (priceIndex < 0) throw new Error("An assessment session is missing from the price history.");
    // Future prices are used only below for outcomes, never for a decision or indicator.
    const study = evaluateStock({ candles: candles.slice(Math.max(0, priceIndex - 4999), priceIndex + 1),
      sources, adjustmentsVerified: input.adjustmentsVerified, isin: input.isin, expectedSession: session, now: assessedAt });
    const entry = candles[priceIndex + 1], exit = candles[priceIndex + horizonSessions + 1];
    let outcome: StockReplayRow["outcome"] = null;
    if (study.paperDecision !== null && entry && exit) {
      const fee = costBpsPerSide / 10000;
      const netPriceReturnPct = (exit.close / entry.close * ((1 - fee) / (1 + fee)) - 1) * 100;
      if (Number.isFinite(netPriceReturnPct)) outcome = { entrySession: entry.date, exitSession: exit.date, netPriceReturnPct };
    }
    rows.push({ session, partition: session < holdoutStart ? "development" : "holdout", study, outcome });
  }
  return { modelVersion: STOCK_MODEL.version, release: "paper" as const, valuationReady: false as const,
    rows, limitations: ["Forward adjusted-price outcomes exclude dividends, taxes and portfolio cash flows.",
      "Next-session closing prices are hypothetical fills, not guaranteed execution prices.",
      "Windows can overlap. Do not compound them or treat them as independent observations.",
      "Selected instruments do not establish delisted coverage or remove survivorship bias.",
      "A holdout date labels observations; this tool cannot prove the data was untouched during development."] };
}
