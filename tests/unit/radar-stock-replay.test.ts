import { describe, expect, it } from "vitest";
import { replayStocks, type StockReplayInput } from "@/lib/radar/stock-replay";

import { sources, candles, isin, session } from "../fixtures/radar-stock";

const input = (): StockReplayInput => ({ isin: "INE000000001", adjustmentsVerified: true,
  candles: Array.from({ length: 270 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), open: 100, high: 100, low: 100, close: 100, volume: 100 })),
  observations: [{ session: "2026-09-17", assessedAt: "2026-09-17T12:00:00Z", sources: null }],
  holdoutStart: "2026-09-17", horizonSessions: 5, costBpsPerSide: 20 });
describe("offline stock replay", () => {
  it("retains missing-source decisions without inventing an outcome or release", () => {
    const result = replayStocks(input());
    expect(result.rows[0].study.paperDecision).toBeNull();
    expect(result.rows[0].outcome).toBeNull();
    expect(result.rows[0].partition).toBe("holdout");
    expect(result.valuationReady).toBe(false);
    expect(result.release).toBe("paper");
  });
  it("does not feed future candles into the assessment", () => {
    const data = input(), original = replayStocks(data).rows[0].study;
    data.candles.slice(260).forEach((c) => { c.open = c.close = c.high = c.low = 1e8; });
    expect(replayStocks(data).rows[0].study).toEqual(original);
  });
  it("measures eligible outcomes from the next close, with costs on both sides", () => {
    const data = input();
    const extra = Array.from({ length: 8 }, (_, i) => ({ date: `2026-11-${17 + i}`, open: 110, high: 110, low: 110, close: 110, volume: 100 }));
    extra[0] = { ...extra[0], open: 100, high: 100, low: 100, close: 100 };
    Object.assign(data, { isin, candles: [...candles, ...extra], observations: [{ session, assessedAt: `${session}T12:00:00Z`, sources: sources() }], holdoutStart: session });
    const result = replayStocks(data), row = result.rows[0];
    expect(row.study.paperDecision).toBe("Buy candidate");
    expect(row.outcome?.entrySession).toBe("2026-11-17");
    expect(row.outcome?.exitSession).toBe("2026-11-22");
    expect(row.outcome?.netPriceReturnPct).toBeCloseTo((1.1 * 0.998 / 1.002 - 1) * 100, 10);
    data.candles.slice(260).forEach((c) => { c.open = c.close = c.high = c.low = 200; });
    expect(replayStocks(data).rows[0].study).toEqual(row.study);
    data.candles = data.candles.slice(0, 262);
    expect(replayStocks(data).rows[0].outcome).toBeNull();
  });
  it.each(["duplicate", "unordered", "missing", "future-assessment", "invalid-time", "unbounded-cost", "invalid-horizon", "invalid-date"])("rejects invalid replay configuration: %s", (change) => {
    const data = input();
    if (change === "duplicate") data.observations.push(data.observations[0]);
    if (change === "unordered") data.candles.reverse();
    if (change === "missing") data.observations[0].session = "2026-12-01";
    if (change === "future-assessment") data.observations[0].assessedAt = "2026-09-18T12:00:00Z";
    if (change === "invalid-time") data.observations[0].assessedAt = "invalid";
    if (change === "unbounded-cost") data.costBpsPerSide = 10001;
    if (change === "invalid-horizon") data.horizonSessions = 1.5;
    if (change === "invalid-date") data.holdoutStart = "2026-02-30";
    expect(() => replayStocks(data)).toThrow();
  });
});
