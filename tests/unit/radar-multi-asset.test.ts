import { describe, expect, it } from "vitest";
import { classifyInstrument, classificationLabel, analysisAsset, needsEtfEvidence } from "@/lib/radar/classification";
import { analyseRadar } from "@/lib/radar/analysis";
import { automaticResearch } from "@/lib/radar/research";
import { ruleSignal } from "@/lib/radar/rule-signal";
const base = { symbol: "SYNTHETIC", isin: "INF000000001", assetType: "equity" as const };
const today = "2026-11-17", now = "2026-11-17T14:25:00Z";
const candles = [{ date: "2026-11-16", open: 100, high: 100, low: 100, close: 100, volume: 1000 }];
const analysis = analyseRadar({ candles, asset: "equity", today, expectedSession: "2026-11-16", adjustmentsVerified: false, priceBelow: null, drawdownPct: null });
describe("separate stock and ETF models", () => {
  it.each([
    ["Synthetic company", "stock", "equity", false, "Stock"],
    ["Synthetic Gold ETF", "etf", "gold_etf", true, "Gold ETF"],
    ["Synthetic Nifty ETF", "etf", "index_etf", true, "Index ETF"],
    ["Synthetic Silver ETF", "etf", null, true, "ETF, model not available"],
    ["Synthetic Debt ETF", "etf", null, true, "ETF, model not available"],
    ["Synthetic Gold Miners ETF", "etf", null, true, "ETF, model not available"],
    ["Synthetic Gold Silver ETF", "etf", null, true, "ETF, model not available"],
  ])("routes %s to its actual source/model type", (name, kind, asset, etf, label) => {
    const classification = classifyInstrument({ ...base, name: name as string });
    expect(classification.kind).toBe(kind);
    expect(classification.asset).toBe(asset);
    expect(needsEtfEvidence(base.assetType, classification)).toBe(etf);
    expect(classificationLabel(classification.asset ?? base.assetType, classification)).toBe(label);
    if (kind === "etf" && asset === null) expect(analysisAsset(base.assetType, classification)).toBe("other_etf");
  });
  it("does not apply the Gold model or require NAV for an ordinary stock", () => {
    const classification = classifyInstrument({ ...base, name: "Synthetic company" });
    const result = automaticResearch({ analysis, classification, asset: "equity", isin: base.isin, exchange: "NSE", today, now });
    expect(result.checks.map((c) => c.id)).toContain("fundamentals");
    expect(result.checks.map((c) => c.id)).not.toContain("gold");
    expect(result.checks.map((c) => c.id)).not.toContain("nav");
    expect(result.goldStudy).toBeUndefined();
    expect(result.label).toBe("Research not ready");
  });
  it("uses underlying-index requirements rather than Gold factors for an index ETF", () => {
    const classification = classifyInstrument({ ...base, name: "Synthetic Nifty ETF" });
    const result = automaticResearch({ analysis, classification, asset: "index_etf", isin: base.isin, exchange: "BSE", today, now });
    expect(result.checks.map((c) => c.id)).toContain("index");
    expect(result.checks.map((c) => c.id)).not.toContain("gold");
    expect(result.goldStudy).toBeUndefined();
  });
  it("never treats an unsupported ETF as a stock or silently substitutes the Gold model", () => {
    const classification = classifyInstrument({ ...base, name: "Synthetic Silver ETF" });
    const asset = analysisAsset(base.assetType, classification);
    const a = analyseRadar({ ...analysis.inputs, candles, asset });
    expect(a.inputs.asset).toBe("other_etf");
    expect(a.blockers.join(" ")).not.toContain("stock scoring");
    const result = automaticResearch({ analysis: a, classification, asset: "equity", isin: base.isin, exchange: "NSE", today, now });
    expect(result.label).toBe("Insufficient data");
    expect(result.goldStudy).toBeUndefined();
    expect(result.checks.map((c) => c.id)).not.toContain("fundamentals");
  });
  it("a legacy stock tag on an unsupported ETF cannot bypass manual entry guards", () => {
    const signal = ruleSignal({ analysis, asset: "equity", expectedSession: "2026-11-16", now,
      classificationVerified: false, rules: { rulesEnabled: true, holdingConfirmed: false,
        priceBelow: 110, drawdownPct: null, sellAbove: null, sellBelow: null } });
    expect(signal.label).toBe("Wait");
    expect(signal.reason).toContain("investment type needs review");
  });
});
