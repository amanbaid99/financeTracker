import { z } from "zod";
import { candleSchema, type Candle } from "./contracts";
import { technicals } from "./analysis";

/** Experimental screening rules, not calibrated return estimates or live advice. */
export const STOCK_MODEL = {
  version: "stock-paper-3", release: "paper" as const,
  weights: { quality: 30, valuation: 30, growth: 20, technical: 20 },
  candidateScore: 75, maxDebtEbitda: 2, minimumMarginPct: 5,
  minimumGrowthPct: 5, maxReportAgeDays: 550,
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const time = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === v;
});
const time = z.iso.datetime({ offset: true });
const source = z.url().refine((v) => new URL(v).protocol === "https:");
const amount = z.number().finite();
const isin = z.string().regex(/^IN[A-Z0-9]{10}$/);
const multiple = z.object({ date, availableAt: time, close: amount.positive(), source,
  earnings: z.object({ end: date, availableAt: time, eps: amount.positive(), source }),
  adjustmentsVerified: z.literal(true),
  earningsBasis: z.literal("last-published-annual-diluted-recurring") });
export const stockSourcesSchema = z.object({
  isin, sector: z.enum(["industrial", "consumer", "technology", "financial", "other"]),
  modelEligibilityVerified: z.literal(true),
  currency: z.literal("INR"), units: z.literal("rupees"), basis: z.literal("consolidated"),
  epsBasis: z.literal("diluted-recurring-split-adjusted"),
  metadataVerified: z.literal(true),
  annualComparabilityVerified: z.literal(true),
  recurringEarningsVerified: z.literal(true),
  annual: z.array(z.object({
    end: date, availableAt: time, source,
    revenue: amount.positive(), netProfit: amount, operatingCash: amount,
    capitalSpending: amount.nonnegative(), debt: amount.nonnegative(),
    cash: amount.nonnegative(), ebitda: amount, eps: amount,
  })).min(3).max(20),
  historicalPe: z.array(multiple).min(3).max(1000),
  peers: z.array(multiple.extend({ isin })).min(3).max(100),
  peerComparabilityVerified: z.literal(true),
});
export type StockSources = z.infer<typeof stockSourcesSchema>;
export interface StockStudy {
  version: string;
  release: "paper";
  paperDecision: "Buy candidate" | "Wait" | null;
  paperScore: number | null;
  missing: string[];
  risks: string[];
  factors: { id: keyof typeof STOCK_MODEL.weights; score: number; weight: number }[];
  metrics: Record<string, number>;
}
const day = 86_400_000;
const closeTime = (d: string) => Date.parse(`${d}T15:30:00+05:30`);
const ordered = (dates: string[]) => dates.every((d, i) => i === 0 || d > dates[i - 1]);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
};

/** Source adapters must supply verified, point-in-time inputs. Raw report tables cannot be passed as canonical facts. */
export function evaluateStock({ candles, adjustmentsVerified, sources, isin: expectedIsin, expectedSession, now }: {
  candles: Candle[]; adjustmentsVerified: boolean; sources?: unknown;
  isin: string | null; expectedSession: string | null; now: string;
}): StockStudy {
  const result: StockStudy = { version: STOCK_MODEL.version, release: "paper", paperDecision: null,
    paperScore: null, missing: [], risks: [], factors: [], metrics: {} };
  const missing = (message: string) => result.missing.push(message);
  const nowMs = Date.parse(now);
  if (!time.safeParse(now).success || !date.safeParse(expectedSession).success ||
      !Number.isFinite(nowMs) || closeTime(expectedSession!) > nowMs)
    missing("A valid completed assessment session and time are required.");
  if (!adjustmentsVerified) missing("Corporate-action-adjusted price and EPS bases must be verified.");
  if (candles.length < 252 || candles.length > 5000 ||
      candles.some((c) => !candleSchema.safeParse(c).success || !date.safeParse(c.date).success) ||
      !ordered(candles.map((c) => c.date)) || candles.at(-1)?.date !== expectedSession)
    missing("At least 252 ordered, valid price sessions ending on the assessment session are required.");
  const parsed = stockSourcesSchema.safeParse(sources);
  if (!parsed.success) {
    missing("Verified annual financials, amount units, comparable accounting, recurring earnings, publication times and comparable valuations are required.");
    return result;
  }
  const data = parsed.data;
  if (!expectedIsin || data.isin !== expectedIsin) missing("Financial sources must match the investment ISIN.");
  if (["financial", "other"].includes(data.sector)) missing("This business needs a separate sector model.");
  if (result.missing.length) return result;
  const annual = data.annual, latest = annual.at(-1)!, first = annual.at(-3)!;
  if (!ordered(annual.map((a) => a.end)) || annual.some((a, i) =>
    a.end > expectedSession! || Date.parse(a.availableAt) > nowMs ||
    Date.parse(a.availableAt) < Date.parse(`${a.end}T00:00:00Z`) ||
    (i > 0 && (Date.parse(a.end) - Date.parse(annual[i - 1].end) < 330 * day ||
      Date.parse(a.end) - Date.parse(annual[i - 1].end) > 400 * day))))
    missing("Annual reports must be consecutive, ordered and published by the assessment time.");
  if (Date.parse(`${expectedSession}T00:00:00Z`) - Date.parse(latest.end) > STOCK_MODEL.maxReportAgeDays * day)
    missing("The latest annual report is too old for this model.");
  const history = data.historicalPe;
  if (!ordered(history.map((p) => p.date)) || new Set(history.map((p) => p.date.slice(0, 4))).size < 3 ||
    history.some((p) => p.date >= expectedSession! || Date.parse(p.availableAt) < closeTime(p.date) || Date.parse(p.availableAt) > nowMs))
    missing("Historical valuation observations need three distinct years and actual availability before assessment.");
  if (new Set(data.peers.map((p) => p.isin)).size !== data.peers.length || data.peers.some((p) =>
    p.isin === expectedIsin || p.date !== expectedSession ||
    Date.parse(p.availableAt) < closeTime(p.date) || Date.parse(p.availableAt) > nowMs))
    missing("At least three distinct comparable peers need same-session, available valuation observations.");
  // A dated multiple alone does not prove which earnings were known in that session.
  // Compute ratios ourselves and reject earnings published after the historical close.
  const valuations = [...history, ...data.peers];
  if (valuations.some((p) => p.earnings.end >= p.date ||
    Date.parse(p.earnings.availableAt) < Date.parse(`${p.earnings.end}T00:00:00Z`) ||
    Date.parse(p.earnings.availableAt) > closeTime(p.date) ||
    Date.parse(`${p.date}T00:00:00Z`) - Date.parse(p.earnings.end) > STOCK_MODEL.maxReportAgeDays * day ||
    (!Number.isFinite(p.close / p.earnings.eps) || p.close / p.earnings.eps <= 0)))
    missing("Each valuation needs valid, timely annual earnings published by its own price session and a verified share-adjustment basis.");
  if (annual.slice(-3).some((a) => a.eps <= 0 || a.netProfit <= 0 || a.ebitda <= 0))
    missing("Loss-making, turnaround and nonpositive-earnings businesses need a different valuation model.");
  if (result.missing.length) return result;
  const recent = annual.slice(-3), close = candles.at(-1)!.close;
  const years = (Date.parse(latest.end) - Date.parse(first.end)) / (365.25 * day);
  const revenueGrowthPct = ((latest.revenue / first.revenue) ** (1 / years) - 1) * 100;
  const epsGrowthPct = ((latest.eps / first.eps) ** (1 / years) - 1) * 100;
  const marginPct = latest.netProfit / latest.revenue * 100;
  const debtEbitda = latest.debt / latest.ebitda;
  const cashConversion = recent.reduce((s, a) => s + a.operatingCash, 0) / recent.reduce((s, a) => s + a.netProfit, 0);
  const pe = close / latest.eps;
  const historicalMedianPe = median(history.map((p) => p.close / p.earnings.eps)), peerMedianPe = median(data.peers.map((p) => p.close / p.earnings.eps));
  const technical = technicals(candles);
  if ([technical.sma200, technical.rsi14].some((v) => v === null || !Number.isFinite(v))) {
    missing("Price indicators could not be calculated reliably."); return result;
  }
  const consistentCash = recent.every((a) => a.operatingCash > 0 && a.operatingCash - a.capitalSpending > 0);
  if (!consistentCash) result.risks.push("Operating or post-capital-spending cash generation was not consistently positive.");
  if (debtEbitda > STOCK_MODEL.maxDebtEbitda) result.risks.push("Debt exceeds the paper model's leverage limit.");
  if (pe > historicalMedianPe || pe > peerMedianPe) result.risks.push("The earnings multiple exceeds its historical or comparable-peer median.");
  const fraction = (checks: boolean[]) => checks.filter(Boolean).length / checks.length * 100;
  const scores = {
    quality: fraction([consistentCash, cashConversion >= 1, debtEbitda <= STOCK_MODEL.maxDebtEbitda, marginPct >= STOCK_MODEL.minimumMarginPct]),
    valuation: fraction([pe <= historicalMedianPe, pe <= peerMedianPe]),
    growth: fraction([revenueGrowthPct >= STOCK_MODEL.minimumGrowthPct, epsGrowthPct >= STOCK_MODEL.minimumGrowthPct]),
    technical: fraction([close >= technical.sma200!, technical.rsi14! >= 35 && technical.rsi14! <= 65]),
  };
  result.metrics = { revenueGrowthPct, epsGrowthPct, marginPct, debtEbitda, cashConversion, pe, historicalMedianPe, peerMedianPe };
  if (Object.values(result.metrics).some((v) => !Number.isFinite(v))) {
    missing("The financial inputs produced an invalid ratio."); result.metrics = {}; return result;
  }
  result.factors = (Object.keys(scores) as (keyof typeof scores)[]).map((id) => ({ id, score: scores[id], weight: STOCK_MODEL.weights[id] }));
  result.paperScore = result.factors.reduce((s, f) => s + f.score * f.weight / 100, 0);
  result.paperDecision = !result.risks.length && result.paperScore >= STOCK_MODEL.candidateScore ? "Buy candidate" : "Wait";
  return result;
}
