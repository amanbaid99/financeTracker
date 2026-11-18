import { describe, expect, it } from "vitest";
import { evaluateStock, STOCK_MODEL } from "@/lib/radar/stock-model";
import { automaticResearch } from "@/lib/radar/research";
import { analyseRadar } from "@/lib/radar/analysis";
import { classifyInstrument } from "@/lib/radar/classification";
import { isin, session, now, sources, candles } from "../fixtures/radar-stock";
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
  it.each(["annualComparabilityVerified", "recurringEarningsVerified"])("never scores apparent growth without %s", (flag) => {
    const data = sources(); data.annual[2].revenue *= 3;
    for (const value of [false, undefined]) {
      const result = run({ ...data, [flag]: value });
      expect(result.paperScore).toBeNull();expect(result.paperDecision).toBeNull();
      expect(result.metrics).toEqual({});expect(result.factors).toEqual([]);
    }
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
  it.each(["future-publication", "before-period", "stale", "future-period", "unadjusted", "missing-earnings", "overflow", "underflow"])("rejects unsupported historical valuation evidence: %s", (change) => {
    const data = sources(), observation = data.historicalPe[0];
    if (change === "future-publication") observation.earnings.availableAt = "2024-01-01T10:00:00Z";
    if (change === "before-period") observation.earnings.availableAt = "2023-03-30T10:00:00Z";
    if (change === "stale") { observation.earnings.end = "2020-03-31"; observation.earnings.availableAt = "2020-05-15T10:00:00Z"; }
    if (change === "future-period") observation.earnings.end = "2024-03-31";
    if (change === "unadjusted") Object.assign(observation, { adjustmentsVerified: false });
    if (change === "missing-earnings") Object.assign(observation, { earnings: undefined });
    if (change === "overflow") { observation.close = 1e308; observation.earnings.eps = 1e-308; }
    if (change === "underflow") { observation.close = 1e-308; observation.earnings.eps = 1e308; }
    expect(run(data).paperScore).toBeNull();
    expect(run(data).paperDecision).toBeNull();
  });
  it("checks peer earnings publication against its own valuation session", () => {
    const data = sources(); data.peers[0].earnings.availableAt = "2026-11-17T01:00:00Z";
    expect(run(data).paperDecision).toBeNull();
  });
  it("derives peer and historical multiples from price and annual earnings", () => {
    const data = sources();
    data.historicalPe.forEach((p) => { p.close = 120; p.earnings.eps = 10; });
    data.peers.forEach((p) => { p.close = 140; p.earnings.eps = 10; });
    const result = run(data);
    expect(result.metrics.historicalMedianPe).toBe(12);
    expect(result.metrics.peerMedianPe).toBe(14);
  });
  it("rejects negative earnings rather than calling a negative P/E cheap", () => {
    const data = sources(); data.annual[2].eps = -1;
    expect(run(data).paperScore).toBeNull();
  });
  it.each(["cash", "debt", "valuation"])("a verified %s risk produces Wait in paper mode", (risk) => {
    const data = sources();
    if (risk === "cash") data.annual[2].operatingCash = -5;
    if (risk === "debt") data.annual[2].debt = 1000;
    if (risk === "valuation") data.peers.forEach((p) => { p.close = 50; });
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
