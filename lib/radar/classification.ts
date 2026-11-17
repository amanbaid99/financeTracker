import type { RadarAsset, RadarInstrument } from "./contracts";
import type { EtfNav } from "./etf-data";

export interface InstrumentClassification {
  asset: RadarAsset | null;
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
      asset: "gold_etf",
      source: "AMFI ISIN",
      needsReview: false,
      explanation: "AMFI identifies the same ISIN as a Gold ETF.",
    };
  const text = `${item.name} ${item.symbol}`;
  if (/funds?\s+of\s+funds?|\bfof\b/i.test(text))
    return {
      asset: null,
      source: "instrument metadata",
      needsReview: true,
      explanation:
        "This is a fund-of-funds wrapper, not a directly traded ETF supported by this research model.",
    };
  const etf = /\betf\b|exchange\s+traded\s+fund|bees\b/i.test(text);
  if (etf && /\bgold\b|goldbees/i.test(text))
    return {
      asset: "gold_etf",
      source: "instrument metadata",
      needsReview: false,
      explanation: "The provider's instrument name identifies a Gold ETF.",
    };
  if (etf && /\bnifty\b|nifty\w*etf|\bsensex\b|\bindex\b|niftybees/i.test(text))
    return {
      asset: "index_etf",
      source: "instrument metadata",
      needsReview: false,
      explanation:
        "The provider's instrument name identifies an index ETF. Its underlying index still needs verification for research.",
    };
  if (etf)
    return {
      asset: null,
      source: "instrument metadata",
      needsReview: true,
      explanation:
        "This is an ETF, but its underlying asset is not identified as supported Gold or index exposure.",
    };
  if (item.assetType && item.assetType !== "equity")
    return {
      asset: item.assetType,
      source: "saved type",
      needsReview: true,
      explanation:
        "ETF type was selected manually and has not been corroborated by provider metadata.",
    };
  return {
    asset: "equity",
    source: "instrument metadata",
    needsReview: false,
    explanation:
      "The selected cash-market instrument is not identified as an ETF by its provider name.",
  };
}
