import {
  candleSchema,
  ENGINE_VERSION,
  type Candle,
  type RadarAnalysis,
  type Technicals,
} from "./contracts";

const average = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;
const nullableAverage = (values: number[], n: number) =>
  values.length < n ? null : average(values.slice(-n));

/** Wilder smoothing, including a neutral 50 when a series is flat. */
export function wilderRsi(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null;
  const deltas = closes.slice(1).map((p, i) => p - closes[i]);
  let gain = average(deltas.slice(0, period).map((d) => Math.max(0, d)));
  let loss = average(deltas.slice(0, period).map((d) => Math.max(0, -d)));
  for (const d of deltas.slice(period)) {
    gain = (gain * (period - 1) + Math.max(0, d)) / period;
    loss = (loss * (period - 1) + Math.max(0, -d)) / period;
  }
  return loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
}

export function technicals(candles: Candle[]): Technicals {
  const closes = candles.map((c) => c.close);
  const last = closes.at(-1);
  const drawdown = (n: number) =>
    last == null || candles.length < n
      ? null
      : (last / Math.max(...candles.slice(-n).map((c) => c.high)) - 1) * 100;
  let volatility60: number | null = null;
  if (closes.length >= 61) {
    const prices = closes.slice(-61);
    const returns = prices.slice(1).map((p, i) => Math.log(p / prices[i]));
    const mean = average(returns);
    volatility60 =
      Math.sqrt(
        returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1),
      ) *
      Math.sqrt(252) *
      100;
  }
  return {
    rsi14: wilderRsi(closes),
    sma50: nullableAverage(closes, 50),
    sma200: nullableAverage(closes, 200),
    volatility60,
    drawdown30: drawdown(30),
    drawdown90: drawdown(90),
    drawdown252: drawdown(252),
    high252:
      candles.length < 252
        ? null
        : Math.max(...candles.slice(-252).map((c) => c.high)),
    low252:
      candles.length < 252
        ? null
        : Math.min(...candles.slice(-252).map((c) => c.low)),
    averageTradedValue20:
      candles.length < 20
        ? null
        : average(candles.slice(-20).map((c) => c.close * c.volume)),
  };
}

/** Technical observations never substitute for the PRD's missing balanced model inputs. */
export function analyseRadar(input: {
  candles: Candle[];
  asset: RadarAnalysis["inputs"]["asset"];
  today: string;
  expectedSession: string | null;
  adjustmentsVerified: boolean;
  priceBelow: number | null;
  drawdownPct: number | null;
}): RadarAnalysis {
  const blockers: string[] = [];
  let candles: Candle[] = [];
  const parsed = input.candles.map((c) => candleSchema.safeParse(c));
  const dates = input.candles.map((c) => c.date);
  if (
    parsed.some((c) => !c.success) ||
    new Set(dates).size !== dates.length ||
    dates.some((d, i) => i > 0 && d <= dates[i - 1])
  )
    blockers.push(
      "Price history is inconsistent. Refresh it before using these figures.",
    );
  else candles = input.candles.filter((c) => c.date < input.today);
  const last = candles.at(-1);
  if (!last) blockers.push("No completed daily sessions are available.");
  if (candles.length < 252)
    blockers.push(
      "At least 252 valid trading sessions are needed for a complete history.",
    );
  if (!input.expectedSession)
    blockers.push(
      "The exchange calendar has not been verified, so freshness cannot be confirmed.",
    );
  else if (!last || last.date !== input.expectedSession)
    blockers.push(
      "The latest completed exchange session is missing or out of date.",
    );
  if (!input.adjustmentsVerified)
    blockers.push(
      "Corporate-action adjustments have not been verified. Indicators are provisional.",
    );
  if (input.asset === "equity")
    blockers.push(
      "Verified fundamentals, historical valuations and a supported sector model are needed for stock scoring.",
    );
  if (input.asset === "gold_etf")
    blockers.push(
      "Gold ETF research scoring needs verified spreads, adjusted history, liquidity checks and a validated model. Official NAV alone does not establish a buying opportunity.",
    );
  if (input.asset === "index_etf")
    blockers.push(
      "Underlying index valuations, index history, ETF NAV and tracking checks are needed for index ETF scoring.",
    );
  if (input.asset === "other_etf")
    blockers.push("This ETF needs a verified underlying asset and a suitable model. Stock and Gold models do not apply by default.");
  const metrics = technicals(candles);
  const observations: string[] = [];
  if (metrics.drawdown90 !== null)
    observations.push(
      `${Math.abs(metrics.drawdown90).toFixed(1)}% below the highest traded price in 90 sessions.`,
    );
  if (last && metrics.sma200 !== null)
    observations.push(
      `Closing price is ${last.close >= metrics.sma200 ? "above" : "below"} its 200-session average.`,
    );
  // Rules are price observations only, and must not fire on unverified/stale sessions.
  const validPrice =
    !!last &&
    !!input.expectedSession &&
    last.date === input.expectedSession &&
    input.adjustmentsVerified;
  return {
    inputs: {
      asset: input.asset,
      today: input.today,
      expectedSession: input.expectedSession,
      adjustmentsVerified: input.adjustmentsVerified,
      priceBelow: input.priceBelow,
      drawdownPct: input.drawdownPct,
    },
    status: "INSUFFICIENT_DATA",
    score: null,
    version: ENGINE_VERSION,
    asOf: last?.date ?? null,
    close: last?.close ?? null,
    sessions: candles.length,
    technicals: metrics,
    blockers,
    observations,
    priceRuleMet:
      validPrice &&
      input.priceBelow !== null &&
      last!.close <= input.priceBelow,
    drawdownRuleMet:
      validPrice &&
      input.drawdownPct !== null &&
      metrics.drawdown90 !== null &&
      metrics.drawdown90 <= -input.drawdownPct,
  };
}
