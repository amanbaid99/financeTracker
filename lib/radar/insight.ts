// Experimental insight: a plain-English lean (buy candidate, hold, wait,
// review selling) from the price signals the app already has, plus the
// paper stock score when its inputs are complete. Owner-approved on 18 Nov
// 2026 as an indicator, not a recommendation: every reason is shown, it is
// labelled experimental and "not investment advice", and it never replaces
// the gated automatic research result.

import { priceFreshness } from "./price-freshness";
import type { Candle, RadarAnalysis } from "./contracts";
import type { StockStudy } from "./stock-model";

export type InsightLean =
  | "Buy candidate"
  | "Add on dips"
  | "Watch"
  | "Hold"
  | "Wait"
  | "Review selling"
  | "Not enough data";

export interface InsightPoint {
  text: string;
  /** +1 supports buying or holding, -1 argues for waiting or selling. */
  tone: 1 | 0 | -1;
}

export interface Insight {
  lean: InsightLean;
  tone: "good" | "neutral" | "bad";
  summary: string;
  points: InsightPoint[];
  /** -6..+6, the sum of the points. */
  score: number;
  asOf: string | null;
}

const pctText = (n: number) => `${Math.abs(n).toFixed(1)}%`;

/** The lean from technicals, NAV premium and the paper stock score. */
export function experimentalInsight({
  analysis,
  owned,
  stockStudy,
  today,
  exchange,
}: {
  analysis: RadarAnalysis | null;
  owned: boolean;
  stockStudy?: StockStudy;
  today: string;
  exchange: string;
}): Insight {
  const empty = (summary: string): Insight => ({
    lean: "Not enough data",
    tone: "neutral",
    summary,
    points: [],
    score: 0,
    asOf: analysis?.asOf ?? null,
  });
  const freshness = priceFreshness(analysis, today, exchange);
  if (!analysis || analysis.close == null || !freshness.current) return empty(freshness.reason ?? "Refresh to get prices.");
  const t = analysis.technicals;
  const close = analysis.close;
  if (t.sma200 == null || t.rsi14 == null)
    return empty(
      "Needs about a year of daily prices (200 sessions) before a lean makes sense.",
    );

  const points: InsightPoint[] = [];
  const above200 = (close / t.sma200 - 1) * 100;
  points.push(
    above200 >= 0
      ? {
          tone: 1,
          text: `Long-term trend is up: the price is ${pctText(above200)} above its 200-day average.`,
        }
      : {
          tone: -1,
          text: `Long-term trend is down: the price is ${pctText(above200)} below its 200-day average.`,
        },
  );
  if (t.sma50 != null)
    points.push(
      t.sma50 >= t.sma200
        ? {
            tone: 1,
            text: "The 50-day average is above the 200-day average, so recent months are stronger than the year.",
          }
        : {
            tone: -1,
            text: "The 50-day average is below the 200-day average, so recent months are weaker than the year.",
          },
    );
  points.push(
    t.rsi14 < 30
      ? {
          tone: 1,
          text: `RSI is ${t.rsi14.toFixed(0)}: the price has fallen fast and may be oversold.`,
        }
      : t.rsi14 > 70
        ? {
            tone: -1,
            text: `RSI is ${t.rsi14.toFixed(0)}: the price has risen fast and may be overbought.`,
          }
        : {
            tone: 0,
            text: `RSI is ${t.rsi14.toFixed(0)}: neither stretched up nor down.`,
          },
  );
  if (t.high252 != null && t.low252 != null && t.high252 > t.low252) {
    const where = (close - t.low252) / (t.high252 - t.low252);
    points.push(
      where <= 0.3
        ? {
            tone: 1,
            text: `It trades in the lower part of its one-year range (${Math.round(where * 100)}% of the way from low to high).`,
          }
        : where >= 0.9
          ? {
              tone: -1,
              text: `It trades near its one-year high (${Math.round(where * 100)}% of the way from low to high), so there's less room from a dip.`,
            }
          : {
              tone: 0,
              text: `It trades mid-range: ${Math.round(where * 100)}% of the way from its one-year low to high.`,
            },
    );
  }
  const nav = analysis.etf?.nav;
  if (nav && nav.nav > 0 && nav.date === analysis.asOf) {
    const premium = (close / nav.nav - 1) * 100;
    if (premium > 1)
      points.push({
        tone: -1,
        text: `It closed ${pctText(premium)} above the fund's own value (NAV), so you'd pay extra.`,
      });
    else if (premium < -1)
      points.push({
        tone: 1,
        text: `It closed ${pctText(premium)} below the fund's own value (NAV).`,
      });
  }
  if (stockStudy?.paperScore != null)
    points.push(
      stockStudy.paperDecision === "Buy candidate"
        ? {
            tone: 1,
            text: `The experimental company check scores ${stockStudy.paperScore}/100 on quality, valuation, growth and trend.`,
          }
        : {
            tone: -1,
            text: `The experimental company check scores ${stockStudy.paperScore}/100, below its 75 bar${stockStudy.risks.length ? `: ${stockStudy.risks[0]}` : ""}.`,
          },
    );

  const score = points.reduce((s, p) => s + p.tone, 0);
  const downtrend = above200 < 0;
  let lean: InsightLean;
  let summary: string;
  if (owned) {
    if (score <= -2 && downtrend) {
      lean = "Review selling";
      summary =
        "Most signals are weak and the trend is down. Worth checking whether your reason for owning it still holds.";
    } else if (score >= 2) {
      lean = "Add on dips";
      summary =
        "Signals are mostly positive. Holding looks fine; dips may be a chance to add.";
    } else {
      lean = "Hold";
      summary = "Signals are mixed. Nothing here says to act right now.";
    }
  } else if (score >= 2) {
    lean = "Buy candidate";
    summary = "Most signals are positive. Worth a closer look before buying.";
  } else if (score <= -2) {
    lean = "Wait";
    summary =
      "Most signals are weak right now. Waiting may give a better entry.";
  } else {
    lean = "Watch";
    summary = "Signals are mixed. Keep watching for a clearer picture.";
  }
  return {
    lean,
    tone:
      lean === "Buy candidate" || lean === "Add on dips"
        ? "good"
        : lean === "Wait" || lean === "Review selling"
          ? "bad"
          : "neutral",
    summary,
    points,
    score,
    asOf: analysis.asOf,
  };
}

export interface LevelSuggestion {
  value: number;
  label: string;
  why: string;
}

/** Round a price to a sensible step for typing in. */
const tidy = (n: number) =>
  n >= 1000
    ? Math.round(n)
    : n >= 100
      ? Math.round(n * 2) / 2
      : Math.round(n * 100) / 100;

/**
 * Ways to pick buy, sell and exit levels from the stock's own price history.
 * They are starting points to choose from, never saved without the owner.
 */
export function suggestedLevels(
  analysis: RadarAnalysis | null,
  context: { today: string; exchange: string },
  candles: Candle[] = [],
): {
  buy: LevelSuggestion[];
  sell: LevelSuggestion[];
  exit: LevelSuggestion[];
} {
  const none = { buy: [], sell: [], exit: [] };
  if (!analysis || analysis.close == null || !priceFreshness(analysis, context.today, context.exchange).current) return none;
  const t = analysis.technicals;
  const close = analysis.close;
  // A typical three-month move, from recent volatility (one standard deviation).
  const move =
    t.volatility60 != null
      ? Math.min(0.3, Math.max(0.05, (t.volatility60 / 100) * 0.5))
      : 0.1;
  const high =
    t.high252 ??
    (candles.length ? Math.max(...candles.map((c) => c.high)) : null);
  const buy: LevelSuggestion[] = [];
  if (t.sma200 != null && t.sma200 < close)
    buy.push({
      value: tidy(t.sma200),
      label: "200-day average",
      why: "Buy if it pulls back to its long-term average, a level many long-term buyers watch.",
    });
  if (high != null)
    buy.push({
      value: tidy(high * (1 - move)),
      label: `${Math.round(move * 100)}% below 1-year high`,
      why: "Buy after a fall about as big as its usual three-month swing.",
    });
  if (t.low252 != null && t.low252 < close)
    buy.push({
      value: tidy(t.low252 * 1.05),
      label: "Near 1-year low",
      why: "Buy only if it gets close to its cheapest price of the past year.",
    });
  const sell: LevelSuggestion[] = [];
  if (high != null && high > close)
    sell.push({
      value: tidy(high),
      label: "1-year high",
      why: "Take some profit if it gets back to its best price of the past year.",
    });
  sell.push({
    value: tidy(close * (1 + 2 * move)),
    label: `${Math.round(2 * move * 100)}% above today`,
    why: "Take some profit after a rise about twice its usual three-month swing.",
  });
  const exit: LevelSuggestion[] = [];
  if (t.sma200 != null)
    exit.push({
      value: tidy(t.sma200 * 0.9),
      label: "10% below 200-day average",
      why: "Rethink holding if the long-term trend clearly breaks.",
    });
  exit.push({
    value: tidy(close * (1 - 1.5 * move)),
    label: `${Math.round(1.5 * move * 100)}% below today`,
    why: "Limit a loss to about one and a half times its usual three-month swing.",
  });
  return {
    buy: buy.filter((s) => s.value > 0 && s.value < close),
    sell: sell.filter((s) => s.value > close),
    exit: exit.filter((s) => s.value > 0 && s.value < close),
  };
}
