import { describe, expect, it } from "vitest";
import { evaluateStock, STOCK_MODEL, type StockSources } from "@/lib/radar/stock-model";
import { automaticResearch } from "@/lib/radar/research";
import { analyseRadar } from "@/lib/radar/analysis";
import { classifyInstrument } from "@/lib/radar/classification";
const isin = "INE000000001", session = "2026-11-16", now = "2026-11-17T04:30:00Z";
const sources = (): StockSources => ({
  isin, sector: "technology", modelEligibilityVerified: true,
  currency: "INR", units: "rupees", basis: "consolidated", epsBasis: "diluted-recurring-split-adjusted", metadataVerified: true,
  annual: [2024, 2025, 2026].map((year, i) => ({ end: `${year}-03-31`, availableAt: `${year}-05-15T10:00:00Z`, source: "https://filings.example/annual",
    revenue: 1000 * 1.1 ** i, netProfit: 100 * 1.1 ** i, operatingCash: 140 * 1.1 ** i, capitalSpending: 10,
    debt: 50, cash: 20, ebitda: 150, eps: 10 * 1.1 ** i })),
  historicalPe: [2023, 2024, 2025].map((year) => ({ date: `${year}-11-15`, availableAt: `${year}-11-15T12:00:00Z`, pe: 20,
    source: "https://valuations.example/history", earningsBasis: "last-published-annual-diluted-recurring" })),
  peers: [2, 3, 4].map((i) => ({ isin: `INE00000000${i}`, date: session, availableAt: `${session}T12:00:00Z`, pe: 20,
    source: "https://valuations.example/peers", earningsBasis: "last-published-annual-diluted-recurring" })),
  peerComparabilityVerified: true,
});
const candles = Array.from({ length: 260 }, (_, i) => ({ date: new Date(Date.UTC(2026, 10, 16 - 259 + i)).toISOString().slice(0, 10), open: 100, high: 100, low: 100, close: 100, volume: 100000 }));
const run = (data: unknown = sources()) => evaluateStock({ candles, sources: data, adjustmentsVerified: true, isin, expectedSession: session, now });
describe("paper stock assessment", () => {
  it("computes deterministic PRD-weighted factors, never a live release", () => {
    const result = run();
    expect(result.missing).toEqual([]);
    expect(result.paperDecision).toBe("Buy candidate");
    expect(result.paperScore).toBe(100);
    expect(result.release).toBe("paper");
    expect(result.factors.map((f) => f.weight)).toEqual([30, 30, 20, 20]);
    expect(result.metrics.pe).toBeCloseTo(100 / 12.1);
    expect(result.metrics.revenueGrowthPct).toBeCloseTo(10, 1);
    expect(run()).toEqual(result);
    expect(STOCK_MODEL.release).toBe("paper");
  });
  it.each([undefined, {}, { ...sources(), metadataVerified: false }, { ...sources(), units: "crores" },
    { ...sources(), basis: "standalone" }, { ...sources(), currency: "USD" },
    { ...sources(), epsBasis: "unadjusted" }, { ...sources(), modelEligibilityVerified: false }])("requires canonical verified metadata: %j", (data) => {
    const result = run(data === undefined ? null : data);
    expect(result.paperScore).toBeNull();expect(result.paperDecision).toBeNull();expect(result.missing.length).toBeGreaterThan(0);
  });
  it.each(["financial", "other"] as const)("rejects unsupported sector %s", (sector) => {
    expect(run({ ...sources(), sector }).missing).toContain("This business needs a separate sector model.");
  });
  it("keeps issuer identity separate from valuation metadata", () => {
    expect(run({ ...sources(), isin: "INE000000009" }).paperScore).toBeNull();
  });
  it("does not use future publication or restatement values", () => {
    const data = sources(); data.annual[2].availableAt = "2026-11-18T10:00:00Z";
    expect(run(data).paperDecision).toBeNull();
    data.annual[2].availableAt = "2026-03-30T10:00:00Z";
    expect(run(data).paperDecision).toBeNull();
  });
  it("rejects duplicate, unordered, missing-year and stale annual periods", () => {
    for (const dates of [["2024-03-31", "2024-03-31", "2026-03-31"], ["2024-03-31", "2026-03-31", "2025-03-31"], ["2022-03-31", "2023-03-31", "2024-03-31"]]) {
      const data = sources(); data.annual.forEach((a, i) => { a.end = dates[i]; a.availableAt = `${dates[i].slice(0, 4)}-05-15T10:00:00Z`; });
      expect(run(data).paperScore).toBeNull();
    }
  });
  it("does not use future, stale, duplicate or self peer valuations", () => {
    for (const change of ["future", "stale", "duplicate", "self", "basis"]) {
      const data = sources();
      if (change === "future") data.peers[0].availableAt = "2026-11-18T12:00:00Z";
      if (change === "stale") data.peers[0].date = "2026-11-13";
      if (change === "duplicate") data.peers[0].isin = data.peers[1].isin;
      if (change === "self") data.peers[0].isin = isin;
      if (change === "basis") Object.assign(data.peers[0], { earningsBasis: "TTM" });
      expect(run(data).paperDecision).toBeNull();
    }
  });
  it("requires dated historical valuations, not current multiples assigned to old dates", () => {
    const data = sources(); data.historicalPe[0].availableAt = "2026-11-18T12:00:00Z";
    expect(run(data).paperScore).toBeNull();
    data.historicalPe = [data.historicalPe[1], data.historicalPe[1], data.historicalPe[2]];
    expect(run(data).paperScore).toBeNull();
  });
  it("rejects negative earnings rather than calling a negative P/E cheap", () => {
    const data = sources(); data.annual[2].eps = -1;
    expect(run(data).paperScore).toBeNull();
  });
  it.each(["cash", "debt", "valuation"])("a verified %s risk produces Wait in paper mode", (risk) => {
    const data = sources();
    if (risk === "cash") data.annual[2].operatingCash = -5;
    if (risk === "debt") data.annual[2].debt = 1000;
    if (risk === "valuation") data.peers.forEach((p) => { p.pe = 5; });
    const result = run(data); expect(result.missing).toEqual([]); expect(result.risks.length).toBeGreaterThan(0); expect(result.paperDecision).toBe("Wait");
  });
  it("rejects unverified, stale, malformed and duplicate price history", () => {
    const input = { candles, sources: sources(), adjustmentsVerified: true, isin, expectedSession: session, now };
    for (const changed of [{ adjustmentsVerified: false }, { candles: candles.slice(1, -1) }, { candles: [...candles, candles.at(-1)!] }, { now: "invalid" }, { now: "2026-11-16T09:00:00Z" }]) {
      expect(evaluateStock({ ...input, ...changed }).paperDecision).toBeNull();
    }
  });
  it("never upgrades automatic research to Buy/Hold/Sell, even when every paper input passes", () => {
    const analysis = analyseRadar({ candles, asset: "equity", today: "2026-11-17", expectedSession: session, adjustmentsVerified: true, priceBelow: null, drawdownPct: null });
    analysis.stockSources = sources();
    const result = automaticResearch({ analysis, asset: "equity", classification: classifyInstrument({ symbol: "SYNTHETIC", name: "Synthetic company", isin }), isin, exchange: "NSE", today: "2026-11-17", now, candles });
    expect(result.stockStudy?.paperDecision).toBe("Buy candidate");
    expect(result.label).toBe("Research not ready");expect(result.score).toBeNull();
  });
});
