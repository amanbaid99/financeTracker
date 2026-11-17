import { z } from "zod";
import { candleSchema, type Candle } from "./contracts";
import { technicals } from "./analysis";
import type { NavHistory } from "./nav-history";
import type { EtfNav, MarketDepth } from "./etf-data";

/** Paper-only engineering model. These explicit guardrails are not calibrated return forecasts. */
export const GOLD_MODEL = {
  version: "gold-paper-1",
  release: "paper" as const,
  minimumSessions: 252,
  maxPremiumPct: 1,
  minimumDiscountPct: -5,
  maxSpreadPct: 0.5,
  minimumDailyTradedValue: 10_000_000,
  maxTrackingErrorPct: 2,
  maxTrackingDifferencePct: 2,
  maxVolatilityPct: 30,
  minimumDrawdownPct: 5,
  maximumDrawdownPct: 20,
  minimumRsi: 30,
  maximumRsi: 60,
};
export interface DatedValue {
  date: string;
  value: number;
  /** Actual publication/availability time, never a substituted fetch time. */
  availableAt: string;
}
export interface GoldSources {
  isin: string;
  navHistory: { source: string; points: DatedValue[] };
  benchmark: {
    source: string;
    basis: "domestic-gold-INR";
    points: DatedValue[];
  };
}
export interface GoldFactor {
  id: string;
  label: string;
  value: number;
  unit: "%" | "RSI" | "INR";
}
export interface GoldStudy {
  version: string;
  release: "paper";
  paperDecision: "Buy candidate" | "Wait" | null;
  missing: string[];
  risks: string[];
  factors: GoldFactor[];
}
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const date = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
});
const datedValue = z.object({
  date: isoDate,
  value: z.number().finite().positive(),
  availableAt: z.iso.datetime({ offset: true }),
});
const source = z.url().refine((v) => v.startsWith("https://"));
const sourceSchema = z.object({
  isin: z.string().regex(/^IN[A-Z0-9]{10}$/),
  navHistory: z.object({ source, points: z.array(datedValue).max(5000) }),
  benchmark: z.object({
    source,
    basis: z.literal("domestic-gold-INR"),
    points: z.array(datedValue).max(5000),
  }),
});
const ordered = (dates: string[]) => dates.every((d, i) => !i || d > dates[i - 1]);

/** Daily return differences, not ETF price differences. Inputs must share every session. */
export function trackingMetrics(nav: number[], benchmark: number[]) {
  if (nav.length !== benchmark.length || nav.length < 61 ||
    [...nav, ...benchmark].some((v) => !Number.isFinite(v) || v <= 0)) return null;
  const differences = nav.slice(1).map((v, i) => v / nav[i] - benchmark[i + 1] / benchmark[i]);
  const mean = differences.reduce((a, b) => a + b, 0) / differences.length;
  const variance = differences.reduce((s, r) => s + (r - mean) ** 2, 0) / (differences.length - 1);
  const years = differences.length / 252;
  return {
    errorPct: Math.sqrt(variance * 252) * 100,
    differencePct: ((nav.at(-1)! / nav[0]) ** (1 / years) -
      (benchmark.at(-1)! / benchmark[0]) ** (1 / years)) * 100,
  };
}

/** Missing evidence stops paper decisions too. No caller-supplied flag can release this model. */
export function evaluateGold({ candles, adjustmentsVerified, sources, isin, nav, depth, expectedSession, now, collectedNavHistory }: {
  candles: Candle[];
  adjustmentsVerified: boolean;
  sources?: GoldSources;
  collectedNavHistory?: NavHistory;
  isin: string | null;
  nav: EtfNav | null;
  depth: MarketDepth | null;
  expectedSession: string | null;
  now: string;
}): GoldStudy {
  const study: GoldStudy = {
    version: GOLD_MODEL.version, release: GOLD_MODEL.release, paperDecision: null,
    missing: [], risks: [], factors: [],
  };
  const addFactor = (id: string, label: string, value: number, unit: GoldFactor["unit"]) => {
    if (Number.isFinite(value)) study.factors.push({ id, label, value, unit });
    else study.missing.push(`${label} could not be calculated.`);
  };
  const time = Date.parse(now);
  const validNow = z.iso.datetime({ offset: true }).safeParse(now).success;
  if (!validNow) study.missing.push("A valid assessment time is needed.");
  const validPrices = candles.length >= GOLD_MODEL.minimumSessions && candles.length <= 5000 &&
    candles.every((c) => candleSchema.safeParse(c).success && isoDate.safeParse(c.date).success) &&
    ordered(candles.map((c) => c.date)) && !!expectedSession &&
    candles.at(-1)?.date === expectedSession;
  if (!validPrices) study.missing.push("252 ordered, valid sessions ending at the expected close are needed.");
  if (!adjustmentsVerified) study.missing.push("A source confirming corporate-action-adjusted history is needed.");
  const close = validPrices ? candles.at(-1)!.close : null;
  const validNav = !!nav && !!isin && nav.isin === isin && nav.goldEtf &&
    nav.date === expectedSession && Number.isFinite(nav.nav) && nav.nav > 0;
  if (!validNav) study.missing.push("An official Gold ETF NAV for this ISIN and closing session is needed.");
  if (validNav && close !== null) {
    const premium = (close / nav.nav - 1) * 100;
    addFactor("premium", "Closing premium to NAV", premium, "%");
    if (premium > GOLD_MODEL.maxPremiumPct) study.risks.push("The closing premium exceeds 1%.");
    if (premium < GOLD_MODEL.minimumDiscountPct) study.risks.push("A discount beyond 5% needs a units and data review.");
  }
  const bookTime = depth?.marketTime ? Date.parse(depth.marketTime) : NaN;
  const validDepth = validNow && depth?.timestampVerified === true &&
    Number.isFinite(bookTime) && time >= bookTime && time - bookTime <= 15 * 60000 &&
    Number.isFinite(depth.bid) && Number.isFinite(depth.ask) && depth.bid > 0 && depth.ask >= depth.bid;
  if (!validDepth) study.missing.push("A bid and ask with a documented market timestamp is needed.");
  else {
    const spread = (depth.ask - depth.bid) / ((depth.ask + depth.bid) / 2) * 100;
    addFactor("spread", "Current spread", spread, "%");
    if (spread > GOLD_MODEL.maxSpreadPct) study.risks.push("The current spread exceeds 0.5%.");
  }
  if (validPrices) {
    const liquidity = technicals(candles).averageTradedValue20!;
    addFactor("liquidity", "20-session daily traded value", liquidity, "INR");
    if (liquidity < GOLD_MODEL.minimumDailyTradedValue) study.risks.push("Daily traded value is below the paper model's ₹1 crore guardrail.");
  }
  const parsed = sourceSchema.safeParse(sources);
  if (!parsed.success || parsed.data.isin !== isin) {
    study.missing.push(collectedNavHistory?.isin === isin
      ? "NAV history is collected, but its publication times and adjustments are unverified. A matched domestic Gold benchmark in INR is still needed."
      : "Matched official NAV history and a sourced domestic Gold benchmark in INR are needed.");
    return study;
  }
  const data = parsed.data;
  const points = [data.navHistory.points, data.benchmark.points];
  const consistentCoverage = (series: DatedValue[]) => series.every((p, i) =>
    !i || Date.parse(p.date) - Date.parse(series[i - 1].date) <= 7 * 86400000);
  const validSeries = validNow && points.every((series) => series.length >= GOLD_MODEL.minimumSessions &&
    ordered(series.map((p) => p.date)) && consistentCoverage(series) &&
    series.at(-1)?.date === expectedSession &&
    series.every((p) => Date.parse(p.availableAt) <= time &&
      Date.parse(p.availableAt) >= Date.parse(`${p.date}T00:00:00+05:30`))) &&
    data.navHistory.points.length === data.benchmark.points.length &&
    data.navHistory.points.every((p, i) => p.date === data.benchmark.points[i].date);
  if (!validSeries) {
    study.missing.push("NAV and benchmark history must share 252 ordered sessions, with actual publication times available by assessment time.");
    return study;
  }
  if (!validNav || Math.abs(data.navHistory.points.at(-1)!.value / nav.nav - 1) > 0.000001) {
    study.missing.push("Historical NAV does not match the official latest NAV.");
    return study;
  }
  const tracking = trackingMetrics(data.navHistory.points.map((p) => p.value), data.benchmark.points.map((p) => p.value))!;
  addFactor("tracking-error", "Annualised tracking error", tracking.errorPct, "%");
  addFactor("tracking-difference", "Annualised tracking difference", tracking.differencePct, "%");
  if (tracking.errorPct > GOLD_MODEL.maxTrackingErrorPct || Math.abs(tracking.differencePct) > GOLD_MODEL.maxTrackingDifferencePct)
    study.risks.push("Tracking error or tracking difference exceeds 2% in the paper model.");
  // Benchmark close-based history measures Gold context, never the ETF's traded-price dip.
  const gold = technicals(data.benchmark.points.map((p) => ({
    date: p.date, open: p.value, high: p.value, low: p.value, close: p.value, volume: 0,
  })));
  addFactor("gold-drawdown", "Gold benchmark drawdown over 90 sessions", gold.drawdown90!, "%");
  addFactor("gold-rsi", "Gold benchmark RSI", gold.rsi14!, "RSI");
  addFactor("gold-volatility", "Gold benchmark volatility", gold.volatility60!, "%");
  const last = data.benchmark.points.at(-1)!.value;
  addFactor("gold-trend", "Gold benchmark vs 200-session average", (last / gold.sma200! - 1) * 100, "%");
  if (study.missing.length) return study;
  const dip = -gold.drawdown90!;
  const candidate = !study.risks.length && dip >= GOLD_MODEL.minimumDrawdownPct &&
    dip <= GOLD_MODEL.maximumDrawdownPct && gold.rsi14! >= GOLD_MODEL.minimumRsi &&
    gold.rsi14! <= GOLD_MODEL.maximumRsi && gold.volatility60! <= GOLD_MODEL.maxVolatilityPct &&
    last >= gold.sma200! * 0.95 && last <= gold.sma50! * 1.05;
  study.paperDecision = candidate ? "Buy candidate" : "Wait";
  return study;
}
