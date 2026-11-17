import { assetLabels, type RadarAsset, type RadarInstrument } from "./contracts";
import type { EtfNav } from "./etf-data";

export interface InstrumentClassification {
  asset: RadarAsset | null;
  kind?: "stock" | "etf" | "fund-of-funds" | "unknown";
  source: "AMFI ISIN" | "instrument metadata" | "saved type";
  needsReview: boolean;
  explanation: string;
}
/** Classify the user's selected instrument, never recommend or substitute another security. */
export function classifyInstrument(
  item: Pick<RadarInstrument, "name" | "symbol" | "isin"> & {
    assetType?: RadarAsset;
  },
  nav?: EtfNav | null,
): InstrumentClassification {
  if (nav && item.isin && nav.isin === item.isin && nav.goldEtf)
    return {
      kind: "etf",
      asset: "gold_etf",
      source: "AMFI ISIN",
      needsReview: false,
      explanation: "AMFI identifies the same ISIN as a Gold ETF.",
    };
  const text = `${item.name} ${item.symbol}`;
  if (/funds?\s+of\s+funds?|\bfof\b/i.test(text))
    return {
      kind: "fund-of-funds",
      asset: null,
      source: "instrument metadata",
      needsReview: true,
      explanation:
        "This is a fund-of-funds wrapper, not a directly traded ETF supported by this research model.",
    };
  const etf = /\betf\b|exchange\s+traded\s+fund|bees\b/i.test(text);
  if (etf && /\bgold\b|goldbees/i.test(text) &&
    !/\bminers?\b|\bmining\b|\bproducers?\b|\bsilver\b|\bmulti[- ]?asset\b/i.test(text))
    return {
      kind: "etf",
      asset: "gold_etf",
      source: "instrument metadata",
      needsReview: false,
      explanation: "The provider's instrument name identifies a Gold ETF.",
    };
  if (etf && /\bnifty\b|nifty\w*etf|\bsensex\b|\bindex\b|niftybees/i.test(text))
    return {
      kind: "etf",
      asset: "index_etf",
      source: "instrument metadata",
      needsReview: false,
      explanation:
        "The provider's instrument name identifies an index ETF. Its underlying index still needs verification for research.",
    };
  if (etf)
    return {
      kind: "etf",
      asset: null,
      source: "instrument metadata",
      needsReview: true,
      explanation:
        "This is an ETF. Its underlying asset and a suitable research model still need verification; it will not use the stock or Gold model by default.",
    };
  if (item.assetType && item.assetType !== "equity")
    return {
      kind: "unknown",
      asset: item.assetType,
      source: "saved type",
      needsReview: true,
      explanation:
        "ETF type was selected manually and has not been corroborated by provider metadata.",
    };
  return {
    kind: "stock",
    asset: "equity",
    source: "instrument metadata",
    needsReview: false,
    explanation:
      "The selected cash-market instrument is not identified as an ETF by its provider name.",
  };
}

/** Derived metadata prevents an unsupported ETF from being presented as a stock. */
export function classificationLabel(asset: RadarAsset, classification?: InstrumentClassification) {
  if (classification?.kind === "fund-of-funds") return "Fund of funds, model unavailable";
  if (classification?.kind === "etf" && !classification.asset) return "ETF, model not available";
  if (classification?.kind === "unknown") return "Investment type unverified";
  return assetLabels[asset];
}
export function needsEtfEvidence(asset: RadarAsset, classification?: InstrumentClassification) {
  return classification?.kind === "etf" || asset !== "equity";
}

export function analysisAsset(asset: RadarAsset, classification?: InstrumentClassification): RadarAsset | "other_etf" {
  return classification?.kind === "etf" && !classification.asset ? "other_etf" : asset;
}
