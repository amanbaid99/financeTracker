import { describe, expect, it } from "vitest";
import { evaluateStockPosition } from "@/lib/radar/stock-position";
import { isin, session, now, sources, candles } from "../fixtures/radar-stock";
import { automaticResearch } from "@/lib/radar/research";
import { analyseRadar } from "@/lib/radar/analysis";
import { classifyInstrument } from "@/lib/radar/classification";
const input = () => ({ candles, sources: sources(), adjustmentsVerified: true, isin, expectedSession: session, now });
const position = () => ({ isin, ownershipConfirmed: true, recordedSharePct: 10, targetSharePct: 10, rebalanceBandPct: 2,
  thesis: "intact", reviewedAt: "2026-11-16T12:00:00Z", costsReviewed: true, estimatedExitCostPct: 1, contextConfirmed: true });
describe("paper holding and exit review", () => {
  it("requires complete context before a Hold candidate", () => {
    const result = evaluateStockPosition(input(), position());
    expect(result.paperDecision).toBe("Hold candidate");
    expect(result.release).toBe("paper");expect(result.valuationReady).toBe(false);
    expect(result.estimatedExitCostPct).toBe(1);
  });
  it.each([null, {}, { ...position(), ownershipConfirmed: false }, { ...position(), costsReviewed: false },
    { ...position(), contextConfirmed: false }, { ...position(), thesis: undefined }, { ...position(), targetSharePct: undefined },
    { ...position(), isin: "INE000000009" }, { ...position(), recordedSharePct: 0 },
    { ...position(), reviewedAt: "2026-11-18T10:00:00Z" }, { ...position(), reviewedAt: "2026-01-01T10:00:00Z" }])("never treats missing or invalid context as Hold: %j", (context) => {
    const result = evaluateStockPosition(input(), context);
    expect(result.paperDecision).toBeNull();expect(result.missing.length).toBeGreaterThan(0);
  });
  it("does not turn a failed entry screen into a sell instruction", () => {
    const data = input();data.sources.peers.forEach((p) => { p.close = 50; });
    expect(evaluateStockPosition(data, position()).paperDecision).toBe("Review holding");
  });
  it.each(["broken", "uncertain"])("keeps thesis outcomes distinct: %s", (thesis) => {
    expect(evaluateStockPosition(input(), { ...position(), thesis }).paperDecision).toBe(thesis === "broken" ? "Review selling" : "Review holding");
  });
  it("only flags rebalancing beyond the confirmed percentage-point band", () => {
    expect(evaluateStockPosition(input(), { ...position(), recordedSharePct: 12 }).paperDecision).toBe("Hold candidate");
    const result = evaluateStockPosition(input(), { ...position(), recordedSharePct: 13 });
    expect(result.paperDecision).toBe("Review selling");expect(result.excessSharePct).toBe(3);
    expect(result.reasons.join(" ")).toContain("not a full-exit instruction");
  });
  it("integrates paper exit review without promoting a live selling recommendation", () => {
    const analysis = analyseRadar({ candles, asset: "equity", today: "2026-11-17", expectedSession: session, adjustmentsVerified: true, priceBelow: null, drawdownPct: null });
    analysis.stockSources = sources();
    const base = { analysis, asset: "equity" as const, classification: classifyInstrument({ symbol: "SYNTHETIC", name: "Synthetic company", isin }), isin, exchange: "NSE", today: "2026-11-17", now, candles, owned: true };
    const result = automaticResearch({ ...base, positionContext: { ...position(), thesis: "broken" } });
    expect(result.stockPositionStudy?.paperDecision).toBe("Review selling");
    expect(result.label).toBe("Research not ready");expect(result.score).toBeNull();
    expect(automaticResearch(base).stockPositionStudy?.paperDecision).toBeNull();
    expect(automaticResearch({ ...base, owned: false }).stockPositionStudy).toBeUndefined();
  });
  it("keeps every holding decision pending when source evidence is missing", () => {
    for (const thesis of ["intact", "broken", "uncertain"]) {
      const result = evaluateStockPosition({ ...input(), adjustmentsVerified: false }, { ...position(), thesis });
      expect(result.paperDecision).toBeNull();expect(result.estimatedExitCostPct).toBeNull();
    }
  });
});
