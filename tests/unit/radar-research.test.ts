import { describe, expect, it } from "vitest";
import { classifyInstrument } from "@/lib/radar/classification";
import { automaticResearch } from "@/lib/radar/research";
import { analyseRadar } from "@/lib/radar/analysis";
import { parseDepth } from "@/lib/radar/etf-data";
import type { RadarAnalysis } from "@/lib/radar/contracts";
const isin = "INF000000001",
  today = "2026-11-17",
  now = "2026-11-17T04:30:00Z";
const nav = {
  isin,
  schemeCode: "123",
  name: "Synthetic",
  date: "2026-11-16",
  nav: 100,
  goldEtf: true,
  source: "AMFI",
};
const instrument = {
  name: "Synthetic Gold ETF",
  symbol: "SYNTHETIC",
  isin,
  assetType: "gold_etf" as const,
};
const classification = classifyInstrument(instrument, nav);
const base = analyseRadar({
  candles: [
    {
      date: "2026-11-16",
      open: 100,
      high: 110,
      low: 90,
      close: 100,
      volume: 1000,
    },
  ],
  asset: "gold_etf",
  today,
  expectedSession: "2026-11-16",
  adjustmentsVerified: false,
  priceBelow: null,
  drawdownPct: null,
});
const analysis: RadarAnalysis = {
  ...base,
  etf: { nav, depth: null, errors: [] },
};
const input = {
  analysis,
  asset: "gold_etf" as const,
  classification,
  isin,
  exchange: "NSE",
  today,
  now,
};

describe("provider-derived instrument types", () => {
  it("corrects previously saved stock labels for Gold and index ETFs", () => {
    expect(
      classifyInstrument({ ...instrument, assetType: "equity" }).asset,
    ).toBe("gold_etf");
    expect(
      classifyInstrument({
        name: "Synthetic Nifty ETF",
        symbol: "SYNTHETIC",
        isin,
        assetType: "equity",
      }).asset,
    ).toBe("index_etf");
  });
  it("does not classify a fund-of-funds wrapper or an unsupported ETF as a stock", () => {
    expect(
      classifyInstrument({
        name: "Synthetic Gold ETF Fund of Fund",
        symbol: "SYNTHETIC",
        isin,
      }).needsReview,
    ).toBe(true);
    expect(
      classifyInstrument({
        name: "Synthetic Silver ETF",
        symbol: "SYNTHETIC",
        isin,
      }).asset,
    ).toBeNull();
  });
  it("uses an exact official ISIN match instead of borrowing another fund's category", () => {
    const stock = {
      name: "Synthetic operating company",
      symbol: "SYNTHETIC",
      isin: "INE000000001",
    };
    expect(classifyInstrument(stock, nav).asset).toBe("equity");
    expect(classifyInstrument({ ...stock, isin }, nav).asset).toBe("gold_etf");
  });
  it("requires corroboration for a manually chosen ETF type without source evidence", () => {
    expect(
      classifyInstrument({
        name: "Synthetic",
        symbol: "SYNTHETIC",
        isin,
        assetType: "gold_etf",
      }).needsReview,
    ).toBe(true);
  });
});
describe("automatic evidence-based research", () => {
  it("runs with no manual rules or thresholds and reports actual completed checks", () => {
    const result = automaticResearch(input);
    expect(result.label).toBe("Research not ready");
    expect(result.checks.find((c) => c.id === "nav")?.state).toBe("ready");
    expect(result.reasons).toContain(
      "Closing price was 0.00% above same-session NAV.",
    );
    expect(result.nextStep).not.toContain("Enable");
    expect(result.score).toBeNull();
    expect(result.blockers).toContainEqual({ label: "Gold ETF research model", owner: "development" });
    expect(result.blockers).toContainEqual({ label: "Timestamped bid-ask spread", owner: "source" });
    expect(result.goldStudy?.release).toBe("paper");
  });
  it("automatically waits on a verified excessive closing premium, without inventing the remaining data", () => {
    const result = automaticResearch({
      ...input,
      analysis: { ...analysis, close: 102 },
    });
    expect(result.label).toBe("Wait");
    expect(result.checks.find((c) => c.id === "premium")?.state).toBe("risk");
    expect(result.checks.find((c) => c.id === "model")?.state).toBe("missing");
    expect(result.score).toBeNull();
  });
  it("does not use a mismatched NAV date or another ISIN to generate a premium conclusion", () => {
    for (const changed of [
      { ...nav, date: "2026-11-13" },
      { ...nav, isin: "INF000000002" },
    ]) {
      const result = automaticResearch({
        ...input,
        analysis: {
          ...analysis,
          close: 120,
          etf: { nav: changed, depth: null, errors: [] },
        },
      });
      expect(result.label).toBe("Research not ready");
      expect(result.reasons).toEqual([]);
    }
  });
  it("never treats an undocumented quote timestamp or recent retrieval as verified book freshness", () => {
    const depth = parseDepth(
      {
        status: "success",
        data: {
          NSE_123: {
            quote_time: now,
            market_depth: {
              depth: [
                {
                  buy: { price: "100", quantity: "1" },
                  sell: { price: "102", quantity: "1" },
                },
              ],
            },
          },
        },
      },
      "NSE_123",
      now,
    );
    expect(depth.timestampVerified).toBe(false);
    const result = automaticResearch({
      ...input,
      analysis: { ...analysis, etf: { nav, depth, errors: [] } },
    });
    expect(result.checks.find((c) => c.id === "spread")?.state).toBe("missing");
    expect(result.label).toBe("Research not ready");
  });
  it("a verified wide spread can block entry, while a stale or future spread cannot masquerade as current", () => {
    const depth = {
      bid: 100,
      ask: 102,
      spreadPct: 1.98,
      marketTime: now,
      timestampVerified: true,
      fetchedAt: now,
    };
    expect(
      automaticResearch({
        ...input,
        analysis: { ...analysis, etf: { nav, depth, errors: [] } },
      }).label,
    ).toBe("Wait");
    for (const time of ["2026-11-17T03:00:00Z", "2026-11-17T05:00:00Z"]) {
      expect(
        automaticResearch({
          ...input,
          analysis: {
            ...analysis,
            etf: { nav, depth: { ...depth, marketTime: time }, errors: [] },
          },
        }).label,
      ).toBe("Research not ready");
    }
  });
  it("rejects stale closes and unsupported calendar dates without demanding manual thresholds", () => {
    expect(
      automaticResearch({
        ...input,
        analysis: { ...analysis, asOf: "2026-11-13" },
      }).checks.find((c) => c.id === "prices")?.state,
    ).toBe("missing");
    expect(
      automaticResearch({ ...input, today: "2027-01-04" }).checks.find(
        (c) => c.id === "calendar",
      )?.state,
    ).toBe("missing");
  });
  it("supports the verified BSE calendar but still requires underlying-index data for index ETFs", () => {
    const result = automaticResearch({
      ...input,
      exchange: "BSE",
      asset: "index_etf",
      classification: classifyInstrument({
        name: "Synthetic Nifty ETF",
        symbol: "SYNTHETIC",
        isin,
        assetType: "equity",
      }),
    });
    expect(result.checks.find((c) => c.id === "calendar")?.state).toBe("ready");
    expect(result.checks.find((c) => c.id === "index")?.state).toBe("missing");
  });
  it("does not issue Hold or Review selling from a watchlist or ownership alone", () => {
    const result = automaticResearch({ ...input, owned: true });
    expect(result.label).toBe("Research not ready");
    expect(result.checks.find((c) => c.id === "portfolio")?.state).toBe(
      "missing",
    );
  });
  it("does not produce a stock conclusion from technical prices when fundamentals are absent", () => {
    const result = automaticResearch({
      ...input,
      asset: "equity",
      classification: classifyInstrument({
        name: "Synthetic operating company",
        symbol: "SYNTHETIC",
        isin: "INE000000001",
      }),
    });
    expect(result.label).toBe("Research not ready");
    expect(result.checks.find((c) => c.id === "fundamentals")?.state).toBe(
      "missing",
    );
  });
});
