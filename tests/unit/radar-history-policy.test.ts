import { describe, expect, it } from "vitest";
import { indstocksHistoryPolicy, readHistoryPolicy, historyBasisText } from "@/lib/radar/history-policy";
import { analyseRadar, technicals } from "@/lib/radar/analysis";
import { automaticResearch } from "@/lib/radar/research";
import { classifyInstrument } from "@/lib/radar/classification";
import { parseHistory } from "@/lib/radar/indmoney";
const now = "2026-11-19T04:30:00Z", today = "2026-11-19";
const candles = Array.from({ length: 260 }, (_, i) => ({ date: new Date(Date.parse("2026-11-18") - (259 - i) * 86400000).toISOString().slice(0, 10), open: 100, high: 100, low: 100, close: 100, volume: 1000 }));
const input = { candles, today, expectedSession: "2026-11-18", asset: "equity" as const, adjustmentsVerified: false, priceBelow: 110, drawdownPct: 5 };
describe("INDstocks support-confirmed history policy", () => {
  it("records partial scope and an actual fresh retrieval time without claiming total-return or turnover data", () => {
    const policy = indstocksHistoryPolicy(now);
    expect(readHistoryPolicy(policy)).toEqual(policy);
    expect(policy.prices).toBe("split-and-bonus-adjusted");expect(policy.volume).toBe("unadjusted-shares");
    expect(policy.dividendsAdjusted).toBe(false);expect(policy.rightsAdjusted).toBe(false);
    expect(policy.mergersAdjusted).toBe(false);expect(policy.demergersAdjusted).toBe(false);
    expect(policy.consolidation).toBe("only-when-recorded-as-split");expect(policy.roundingDecimals).toBe(2);
    expect(policy.fullActionCoverageVerified).toBe(false);expect(policy.turnoverBasisVerified).toBe(false);
  });
  it("does not relabel legacy history, pre-confirmation retrievals or tampered coverage", () => {
    expect(readHistoryPolicy(undefined)).toBeUndefined();
    expect(() => indstocksHistoryPolicy("2026-11-17T12:00:00Z")).toThrow();
    expect(readHistoryPolicy({ ...indstocksHistoryPolicy(now), fullActionCoverageVerified: true })).toBeUndefined();
    expect(historyBasisText(undefined)).toContain("unverified for this saved snapshot");
  });
  it("retains OHLC prices and raw volume exactly as supplied without applying a second split adjustment", () => {
    const result = parseHistory({ success: true, data: { NSE_123: { candles: [{ ts: 1750041000, o: 812.5, h: 820, l: 808.1, c: 815.4, v: 4120533 }] } } }, "NSE_123");
    expect(result[0]).toMatchObject({ open: 812.5, high: 820, low: 808.1, close: 815.4, volume: 4120533 });
  });
  it("never promotes a partial policy to full adjustment or turnover verification", () => {
    const result = analyseRadar({ ...input, adjustmentsVerified: true, turnoverBasisVerified: true, historyPolicy: indstocksHistoryPolicy(now) });
    expect(result.inputs.adjustmentsVerified).toBe(false);expect(result.inputs.turnoverBasisVerified).toBe(false);
    expect(result.technicals.averageTradedValue20).toBeNull();expect(result.technicals.sma200).toBe(100);
    expect(result.drawdownRuleMet).toBe(false);expect(result.priceRuleMet).toBe(false);
    expect(result.score).toBeNull();expect(result.status).toBe("INSUFFICIENT_DATA");
  });
  it("does not infer historic turnover from adjusted prices and raw volume", () => {
    expect(technicals(candles).averageTradedValue20).toBeNull();
    expect(technicals(candles, true).averageTradedValue20).toBe(100000);
  });
  it("shows policy progress while retaining the live recommendation gate", () => {
    const analysis = analyseRadar({ ...input, historyPolicy: indstocksHistoryPolicy(now) });
    const result = automaticResearch({ analysis, candles, asset: "equity", classification: classifyInstrument({ symbol: "SYNTHETIC", name: "Synthetic company", isin: "INE000000001" }), isin: "INE000000001", exchange: "NSE", today, now });
    expect(result.checks.find(c => c.id === "adjustment-policy")?.state).toBe("ready");
    expect(result.checks.find(c => c.id === "history")?.state).toBe("missing");
    expect(result.label).toBe("Research not ready");expect(result.score).toBeNull();
  });
  it("withholds legacy snapshot liquidity even if an old calculator stored a numeric estimate", () => {
    const analysis = analyseRadar({ ...input, asset: "gold_etf" });analysis.technicals.averageTradedValue20 = 1e9;
    const result = automaticResearch({ analysis, candles, asset: "gold_etf", classification: classifyInstrument({ symbol: "SYNTHETIC", name: "Synthetic Gold ETF", isin: "INF000000001" }), isin: "INF000000001", exchange: "NSE", today, now });
    expect(result.checks.find(c => c.id === "liquidity")?.state).toBe("missing");
  });
});
