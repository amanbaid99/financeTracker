import type { InstrumentClassification } from "./classification";
import { evaluateGold, type GoldStudy } from "./gold-model";
import type { Candle, RadarAnalysis, RadarAsset } from "./contracts";
import { previousCompletedSession } from "./calendar";

export type ResearchLabel =
  | "Buy candidate"
  | "Hold"
  | "Review selling"
  | "Wait"
  | "Insufficient data"
  | "Research not ready";
export interface ResearchCheck {
  id: string;
  label: string;
  state: "ready" | "missing" | "risk";
  detail: string;
}
export interface ResearchResult {
  label: ResearchLabel;
  summary: string;
  asOf: string | null;
  reasons: string[];
  checks: ResearchCheck[];
  nextStep: string;
  version: string;
  score: null;
  goldStudy?: GoldStudy;
  blockers: {
    label: string;
    owner: "source" | "development" | "refresh" | "context";
  }[];
}
const VERSION = "automatic-research-0.4";
/** Automatic evidence review, independent of manual price rules. Never claim a validated valuation model exists. */
export function automaticResearch({
  analysis,
  asset,
  classification,
  isin,
  exchange,
  today,
  now,
  owned = false,
  candles = [],
}: {
  analysis: RadarAnalysis | null;
  asset: RadarAsset;
  classification: InstrumentClassification;
  isin: string | null;
  exchange: string;
  today: string;
  now: string;
  owned?: boolean;
  candles?: Candle[];
}): ResearchResult {
  const expected = previousCompletedSession(today, exchange);
  let goldStudy: GoldStudy | undefined;
  const checks: ResearchCheck[] = [];
  const reasons: string[] = [];
  const add = (
    id: string,
    label: string,
    state: ResearchCheck["state"],
    detail: string,
  ) => checks.push({ id, label, state, detail });
  const result = (
    label: ResearchLabel,
    summary: string,
    nextStep: string,
  ): ResearchResult => ({
    label,
    summary,
    nextStep,
    asOf: analysis?.asOf ?? null,
    checks,
    reasons,
    version: VERSION,
    score: null,
    goldStudy,
    blockers: checks.filter((c) => c.state === "missing").map((c) => ({
      label: c.label,
      owner: c.id === "model" ? "development" : c.id === "portfolio" ? "context" :
        ["prices", "nav", "classification"].includes(c.id) ? "refresh" : "source",
    })),
  });
  add(
    "classification",
    "Investment type",
    classification.needsReview ? "missing" : "ready",
    classification.explanation,
  );
  if (classification.needsReview)
    return result(
      "Insufficient data",
      "The investment type needs verification before applying an asset-specific model.",
      "Check the provider instrument name and ISIN. Do not use a stock model for an unverified ETF.",
    );
  add(
    "calendar",
    "Trading calendar",
    expected ? "ready" : "missing",
    expected
      ? `Latest completed prior session: ${expected}.`
      : `The calendar is not verified for ${exchange} on this date.`,
  );
  const aligned =
    !!analysis &&
    analysis.close !== null &&
    !!expected &&
    analysis.asOf === expected;
  add(
    "prices",
    "Closing price",
    aligned ? "ready" : "missing",
    aligned
      ? `Closing price matches ${expected}.`
      : "A closing price for the latest verified session is needed.",
  );
  if (!analysis || !aligned)
    return result(
      "Insufficient data",
      "Current completed-session prices are needed to run automatic research.",
      expected
        ? "Refresh research to fetch daily prices and source checks."
        : "The exchange calendar needs updating before price freshness can be confirmed.",
    );
  add(
    "history",
    "History and adjustments",
    analysis.sessions >= 252 && analysis.inputs.adjustmentsVerified
      ? "ready"
      : "missing",
    analysis.sessions < 252
      ? "At least 252 valid sessions are needed."
      : analysis.inputs.adjustmentsVerified
        ? "Corporate-action adjustments are verified."
        : "Price history is available, but corporate-action adjustments are unverified. Momentum cannot establish a buying opportunity.",
  );
  if (asset === "equity") {
    add(
      "fundamentals",
      "Fundamentals and valuation",
      "missing",
      "Verified financial statements, sector support and historical/peer valuations are not connected.",
    );
    add(
      "model",
      "Stock research model",
      "missing",
      "The stock model still needs implementation and testing. Refreshing prices cannot complete this work.",
    );
    if (owned)
      add(
        "portfolio",
        "Holding and exit context",
        "missing",
        "Ownership is known, but target allocation, thesis and exit costs have not been assessed.",
      );
    return result(
      "Research not ready",
      "Stock research is not ready. Financial-data sources and the stock assessment model are still missing.",
      "Stock research needs a connected financial-data source and a supported sector model. You do not need to configure price rules.",
    );
  }
  const nav = analysis.etf?.nav;
  const navIdentity = !!nav && !!isin && nav.isin === isin;
  const navAligned =
    navIdentity && nav!.date === expected && nav!.date === analysis.asOf;
  const navKind = asset !== "gold_etf" || !!nav?.goldEtf;
  add(
    "nav",
    "Official same-session NAV",
    navAligned && navKind ? "ready" : "missing",
    !navIdentity
      ? "No unambiguous official NAV matches this ISIN."
      : !navKind
        ? "AMFI has not identified this ISIN as a Gold ETF."
        : !navAligned
          ? "Official NAV and closing price are from different sessions."
          : `AMFI NAV matches this ISIN and session ${nav!.date}.`,
  );
  let premium: number | null = null;
  if (navAligned && navKind && nav!.nav > 0 && Number.isFinite(nav!.nav)) {
    premium = (analysis.close! / nav!.nav - 1) * 100;
    reasons.push(
      `Closing price was ${Math.abs(premium).toFixed(2)}% ${premium >= 0 ? "above" : "below"} same-session NAV.`,
    );
  }
  const depth = analysis.etf?.depth;
  // quote_time is not part of INDmoney's documented REST contract. Stored/fetch timestamps are not sufficient evidence.
  const depthAge = depth?.marketTime
    ? Date.parse(now) - Date.parse(depth.marketTime)
    : Infinity;
  const spreadVerified =
    depth?.timestampVerified === true &&
    Number.isFinite(depthAge) &&
    depthAge >= 0 &&
    depthAge <= 15 * 60000;
  const spreadRisk = spreadVerified && !!depth && depth.spreadPct > 0.5;
  add(
    "spread",
    "Timestamped bid-ask spread",
    !spreadVerified ? "missing" : spreadRisk ? "risk" : "ready",
    !spreadVerified
      ? "The REST quote has no verified market-time contract. Fetch time and undocumented fields do not establish spread freshness."
      : `Verified spread: ${depth!.spreadPct.toFixed(2)}%.`,
  );
  const liquidity = analysis.technicals.averageTradedValue20;
  add(
    "liquidity",
    "Trading liquidity",
    liquidity != null && liquidity > 0 ? "ready" : "missing",
    liquidity != null && liquidity > 0
      ? "20-session average traded value is available. This is not a guarantee of execution at your order size."
      : "Enough volume history is needed to assess traded liquidity.",
  );
  if (asset === "index_etf") {
    add(
      "index",
      "Underlying index valuation and tracking",
      "missing",
      "Verified underlying-index valuation/history and ETF tracking metrics are not connected.",
    );
    add(
      "model",
      "Index ETF research model",
      "missing",
      "The index model still needs implementation and testing. Refreshing prices cannot complete this work.",
    );
  } else {
    goldStudy = evaluateGold({
      candles, adjustmentsVerified: analysis.inputs.adjustmentsVerified,
      sources: analysis.etf?.goldSources, isin, nav: nav ?? null,
      depth: depth ?? null, expectedSession: expected, now,
    });
    add(
      "gold",
      "Underlying Gold context",
      "missing",
      "Gold's underlying price/valuation context and benchmark/tracking quality are not verified. A discount to NAV alone does not mean Gold is cheap.",
    );
    add(
      "model",
      "Gold ETF research model",
      "missing",
      "The first Gold model is implemented for paper testing. Historical validation and live paper monitoring are still required before releasing recommendations. No predictive score is produced.",
    );
  }
  if (owned)
    add(
      "portfolio",
      "Holding and exit context",
      "missing",
      "The matched holding does not establish target allocation or an exit case. Hold and Review selling need this additional context.",
    );
  // A known risk can justify waiting to add, without claiming the remaining missing data passed.
  if (premium !== null && premium > 1) {
    add(
      "premium",
      "Closing premium",
      "risk",
      `Closing premium ${premium.toFixed(2)}% exceeds the conservative 1% entry guardrail. It is not a forecast of Gold returns.`,
    );
    return result(
      "Wait",
      "The latest verified close was above NAV by more than the entry guardrail. Avoid treating a price dip as a bargain.",
      "Recheck the premium and the remaining source/model checks before considering an addition. This does not recommend selling an existing holding.",
    );
  }
  if (premium !== null && premium < -5) {
    add(
      "premium",
      "Closing discount",
      "risk",
      "A discount beyond 5% may indicate inconsistent units, a corporate action or source problems.",
    );
    return result(
      "Wait",
      "The price/NAV difference needs a data-quality review, not an automatic bargain label.",
      "Verify instrument identity, units and corporate actions before using this comparison.",
    );
  }
  if (spreadRisk)
    return result(
      "Wait",
      "The verified spread is too wide for the entry guardrail.",
      "Recheck trading conditions and remaining research inputs. A wide spread is not a reason by itself to sell.",
    );
  return result(
    "Research not ready",
    navAligned && navKind
      ? "NAV comparison works. Buy and exit research still needs additional market data and model validation."
      : "Buy and exit research is not ready. Some market-data sources and model work are still missing.",
    "No settings to change. Refresh updates prices and NAV only. Open the checks below to see the source and model work still needed.",
  );
}
