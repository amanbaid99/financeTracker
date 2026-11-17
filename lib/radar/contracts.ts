import type { StockFinancials } from "./stock-financials";
import type { InstrumentClassification } from "./classification";
import type { EtfEvidence, MarketEvidence } from "./etf-data";
import type { RuleSettings } from "./rule-signal";
import { z } from "zod";

export const assetTypes = ["equity", "gold_etf", "index_etf"] as const;
export type RadarAsset = (typeof assetTypes)[number];
export const assetLabels: Record<RadarAsset, string> = {
  equity: "Stock",
  gold_etf: "Gold ETF",
  index_etf: "Index ETF",
};
export const instrumentSchema = z.object({
  exchange: z.enum(["NSE", "BSE"]),
  securityId: z.string().regex(/^\d{1,12}$/),
  symbol: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(160),
  isin: z
    .string()
    .regex(/^IN[A-Z0-9]{10}$/)
    .nullable(),
});
export type RadarInstrument = z.infer<typeof instrumentSchema>;
export const watchSchema = instrumentSchema.extend({
  assetType: z.enum(assetTypes),
  priceBelow: z.number().finite().positive().max(1e8).nullable(),
  drawdownPct: z.number().finite().min(1).max(80).nullable(),
});
export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
export const candleSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    open: z.number().finite().positive(),
    high: z.number().finite().positive(),
    low: z.number().finite().positive(),
    close: z.number().finite().positive(),
    volume: z.number().finite().nonnegative(),
  })
  .refine(
    (c) =>
      c.low <= Math.min(c.open, c.close) &&
      c.high >= Math.max(c.open, c.close) &&
      c.high >= c.low,
    "Inconsistent OHLC values",
  );
export interface Technicals {
  rsi14: number | null;
  sma50: number | null;
  sma200: number | null;
  volatility60: number | null;
  drawdown30: number | null;
  drawdown90: number | null;
  drawdown252: number | null;
  high252: number | null;
  low252: number | null;
  averageTradedValue20: number | null;
}
export const ENGINE_VERSION = "radar-stock-financials-0.7";
export interface RadarAnalysis {
  inputs: {
    asset: RadarAsset | "other_etf";
    today: string;
    expectedSession: string | null;
    adjustmentsVerified: boolean;
    priceBelow: number | null;
    drawdownPct: number | null;
  };
  etf?: EtfEvidence;
  market?: MarketEvidence;
  financials?: StockFinancials;
  financialsError?: string;
  status: "INSUFFICIENT_DATA";
  score: null;
  version: string;
  asOf: string | null;
  close: number | null;
  sessions: number;
  technicals: Technicals;
  blockers: string[];
  observations: string[];
  priceRuleMet: boolean;
  drawdownRuleMet: boolean;
}
export interface WatchItem extends RadarInstrument {
  id: string;
  assetType: RadarAsset;
  priceBelow: number | null;
  drawdownPct: number | null;
  rules?: RuleSettings;
  classification?: InstrumentClassification;
  ownedInTracker?: boolean;
}
export interface RadarSnapshot {
  id: string;
  watchId: string;
  fetchedAt: string;
  source: string;
  candles: Candle[];
  analysis: RadarAnalysis;
}
export const marketPrice = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
