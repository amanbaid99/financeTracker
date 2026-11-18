import { describe, expect, it } from "vitest";
import { priceFreshness } from "@/lib/radar/price-freshness";
import { experimentalInsight, suggestedLevels } from "@/lib/radar/insight";
import { dipPlan } from "@/lib/radar/dip-plan";
import type { RadarAnalysis } from "@/lib/radar/contracts";
const context = { today: "2026-11-18", exchange: "NSE" };
const analysis = (asOf = "2026-11-17") => ({ asOf, close: 95,
  inputs: { today: "2026-11-17", expectedSession: "2026-11-16" },
  technicals: { sma200: 90, sma50: 92, rsi14: 28, low252: 85, high252: 140, volatility60: 20 },
}) as RadarAnalysis;
describe("current-session experimental research", () => {
  it("uses today's exchange calendar rather than yesterday's saved expected session", () => {
    expect(priceFreshness(analysis(), context.today, context.exchange).current).toBe(true);
    expect(experimentalInsight({ ...context, analysis: analysis(), owned: false }).lean).toBe("Buy candidate");
  });
  it.each(["2026-11-16", "2026-11-18", "2026-11-19", "invalid"])("pauses all actionable output for session %s", (asOf) => {
    for (const owned of [false, true]) {
      const stale = analysis(asOf);
      const insight = experimentalInsight({ ...context, analysis: stale, owned });
      expect(insight.lean).toBe("Not enough data");expect(insight.points).toEqual([]);expect(insight.score).toBe(0);
      expect(suggestedLevels(stale, context)).toEqual({ buy: [], sell: [], exit: [] });
      const row = dipPlan({ today: context.today, budget: 5000, items: [{ id: "synthetic", symbol: "SYNTHETIC", exchange: context.exchange, priceBelow: 100, owned, analysis: stale }] })[0];
      expect(row.budget).toBe(0);expect(row.buys).toEqual([]);expect(row.sell).toBeNull();expect(row.note).toContain("Refresh");
    }
  });
  it.each(["NSE", "BSE"])("handles weekends, holidays and the special session for %s", (exchange) => {
    for (const [today, last] of [["2026-11-16", "2026-11-13"], ["2026-11-11", "2026-11-09"], ["2026-11-09", "2026-11-08"]])
      expect(priceFreshness(analysis(last), today, exchange).current).toBe(true);
  });
  it.each([["2027-01-01", "NSE"], ["2026-11-31", "NSE"], ["2026-11-18", "UNKNOWN"]])("pauses on an unverified calendar: %s %s", (today, exchange) => {
    expect(experimentalInsight({ analysis: analysis(), owned: true, today, exchange }).lean).toBe("Not enough data");
    expect(suggestedLevels(analysis(), { today, exchange }).buy).toEqual([]);
  });
  it.each([0, -1, Infinity, NaN])("does not allocate money to an invalid price %s", (close) => {
    const invalid = { ...analysis(), close };
    expect(priceFreshness(invalid, context.today, context.exchange).close).toBeNull();
    expect(experimentalInsight({ ...context, analysis: invalid, owned: false }).lean).toBe("Not enough data");
  });
  it("allocates only to current prices while keeping the stale saved close visible", () => {
    const rows = dipPlan({ today: context.today, budget: 5000, items: [
      { id: "fresh", symbol: "CURRENT", exchange: "NSE", priceBelow: 100, owned: false, analysis: analysis() },
      { id: "stale", symbol: "OLD", exchange: "BSE", priceBelow: 100, owned: true, analysis: analysis("2026-11-16") },
    ] });
    expect(rows.map(r => r.budget)).toEqual([5000, 0]);expect(rows[1].close).toBe(95);expect(rows[1].asOf).toBe("2026-11-16");
    expect(rows[0].buys.some(b => b.reached)).toBe(true);expect(rows[1].buys).toEqual([]);
  });
});
