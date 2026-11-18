import { describe, expect, it } from "vitest";
import { experimentalInsight, suggestedLevels } from "@/lib/radar/insight";
import type { RadarAnalysis, Technicals } from "@/lib/radar/contracts";

const context = { today: "2026-11-18", exchange: "NSE" };
const tech = (t: Partial<Technicals>): Technicals => ({
  rsi14: 50,
  sma50: 100,
  sma200: 100,
  volatility60: 30,
  drawdown30: null,
  drawdown90: null,
  drawdown252: null,
  high252: 130,
  low252: 80,
  averageTradedValue20: null,
  ...t,
});
const analysis = (close: number | null, t: Partial<Technicals> = {}) =>
  ({
    close,
    asOf: "2026-11-17",
    technicals: tech(t),
  }) as unknown as RadarAnalysis;

describe("experimentalInsight", () => {
  it("needs prices and a year of history", () => {
    expect(experimentalInsight({ ...context, analysis: null, owned: false }).lean).toBe(
      "Not enough data",
    );
    expect(
      experimentalInsight({ ...context,
        analysis: analysis(100, { sma200: null }),
        owned: false,
      }).lean,
    ).toBe("Not enough data");
  });

  it("calls an uptrend in the lower part of its range with an oversold RSI a buy candidate", () => {
    const i = experimentalInsight({ ...context,
      analysis: analysis(95, {
        sma200: 90,
        sma50: 92,
        rsi14: 28,
        low252: 85,
        high252: 140,
      }),
      owned: false,
    });
    expect(i.lean).toBe("Buy candidate");
    expect(i.tone).toBe("good");
    expect(i.points.length).toBe(4);
  });

  it("says wait when the trend is down and the price is stretched near its high", () => {
    const i = experimentalInsight({ ...context,
      analysis: analysis(125, {
        sma200: 130,
        sma50: 120,
        rsi14: 75,
        low252: 80,
        high252: 128,
      }),
      owned: false,
    });
    expect(i.lean).toBe("Wait");
  });

  it("for an owned stock, suggests reviewing a sale only in a weak downtrend", () => {
    const weak = analysis(125, {
      sma200: 130,
      sma50: 120,
      rsi14: 75,
      low252: 80,
      high252: 128,
    });
    expect(experimentalInsight({ ...context, analysis: weak, owned: true }).lean).toBe(
      "Review selling",
    );
    const mixed = analysis(110, { sma200: 100, sma50: 98, rsi14: 50 });
    expect(experimentalInsight({ ...context, analysis: mixed, owned: true }).lean).toBe(
      "Hold",
    );
  });

  it("counts a fund trading above its NAV against buying", () => {
    const a = analysis(100, {}) as RadarAnalysis & { etf: unknown };
    (a as unknown as { etf: unknown }).etf = {
      nav: { nav: 95, date: "2026-11-17" },
    };
    const i = experimentalInsight({ ...context, analysis: a, owned: false });
    expect(
      i.points.some(
        (p) => p.tone === -1 && /above the fund's own value/.test(p.text),
      ),
    ).toBe(true);
  });
});

describe("suggestedLevels", () => {
  it("offers buy levels below today and sell levels above, from the stock's own history", () => {
    const l = suggestedLevels(
      analysis(115, {
        sma200: 100,
        high252: 130,
        low252: 80,
        volatility60: 30,
      }), context,
    );
    expect(l.buy.map((x) => x.label)).toEqual([
      "200-day average",
      "15% below 1-year high",
      "Near 1-year low",
    ]);
    expect(l.buy.every((x) => x.value < 115)).toBe(true);
    expect(l.sell.map((x) => x.value)).toEqual([130, 149.5]);
    expect(l.exit.every((x) => x.value < 115)).toBe(true);
  });

  it("returns nothing without a price", () => {
    expect(suggestedLevels(null, context)).toEqual({ buy: [], sell: [], exit: [] });
  });
});
