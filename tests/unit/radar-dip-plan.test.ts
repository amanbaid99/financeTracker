import { describe, expect, it } from "vitest";
import { dipPlan } from "@/lib/radar/dip-plan";
import type { RadarAnalysis } from "@/lib/radar/contracts";

const analysis = (close: number, t: Record<string, number | null>) =>
  ({
    close,
    asOf: "2026-11-17",
    technicals: {
      rsi14: 50,
      sma50: null,
      sma200: null,
      volatility60: 26,
      drawdown30: null,
      drawdown90: null,
      drawdown252: null,
      high252: null,
      low252: null,
      averageTradedValue20: null,
      ...t,
    },
  }) as unknown as RadarAnalysis;

describe("dipPlan", () => {
  const eternal = analysis(375.05, {
    sma200: 285.2,
    high252: 378,
    low252: 212.6,
  });
  const gold = analysis(113.59, {
    sma200: 127.5,
    high252: 152.3,
    low252: 100.8,
    volatility60: 18.4,
  });

  it("splits the budget, starts at your buy price, then the next dip below it", () => {
    const [e, g] = dipPlan({
      budget: 5000,
      items: [
        {
          id: "e",
          symbol: "ETERNAL",
          priceBelow: 329,
          owned: false,
          analysis: eternal,
        },
        {
          id: "g",
          symbol: "HDFCGOLD",
          priceBelow: 106,
          owned: false,
          analysis: gold,
        },
      ],
    });
    expect(e.budget).toBe(2500);
    expect(e.buys.map((b) => [b.price, b.quantity, b.basis])).toEqual([
      [329, 3, "Your buy price"],
      [285, 4, "200-day average"],
    ]);
    expect(g.buys.map((b) => [b.price, b.quantity, b.basis])).toEqual([
      [106, 11, "Your buy price"],
      [100.8, 12, "1-year low"],
    ]);
    expect(g.buys[0].reached).toBe(false);
    expect(g.sell).toBeNull();
  });

  it("marks a step reached and gives a take-profit price for holdings", () => {
    const [row] = dipPlan({
      budget: 2000,
      items: [
        {
          id: "e",
          symbol: "E",
          priceBelow: 400,
          owned: true,
          analysis: eternal,
        },
      ],
    });
    expect(row.buys[0].reached).toBe(true);
    expect(row.sell?.price).toBe(378);
  });

  it("splits the budget only across items with prices", () => {
    const rows = dipPlan({
      budget: 5000,
      items: [
        {
          id: "e",
          symbol: "E",
          priceBelow: 329,
          owned: false,
          analysis: eternal,
        },
        {
          id: "x",
          symbol: "X",
          priceBelow: null,
          owned: false,
          analysis: null,
        },
      ],
    });
    expect(rows.map((r) => r.budget)).toEqual([5000, 0]);
  });

  it("asks for a refresh when there are no prices", () => {
    const [row] = dipPlan({
      budget: 1000,
      items: [
        {
          id: "x",
          symbol: "X",
          priceBelow: null,
          owned: false,
          analysis: null,
        },
      ],
    });
    expect(row.note).toBe("Refresh to get prices.");
  });
});
