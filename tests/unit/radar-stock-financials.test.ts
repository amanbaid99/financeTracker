import { describe, expect, it, vi } from "vitest";
import { IndianFinancialProvider, parseFinancialReport, financialSymbol, canReuseFinancials } from "@/lib/radar/stock-financials";
import { automaticResearch } from "@/lib/radar/research";
import { analyseRadar } from "@/lib/radar/analysis";
import { classifyInstrument } from "@/lib/radar/classification";
const today = "2026-11-17", now = "2026-11-17T16:00:00Z";
const symbol = "SYNTHETIC";
const instrument = { exchange: "NSE" as const, symbol, securityId: "123", isin: "INE000000001", name: "Synthetic company" };
const reports = {
  "Sales": { "Mar 2024": 100, "Mar 2025": "110.5", "TTM": 120, "Mar 2027": 140 },
  "Net Profit": { "Mar 2024": -5, "Mar 2025": null },
  "EPS in Rs": { "Mar 2024": "-1.25", "Mar 2025": "--" },
};
const request = () => vi.fn().mockImplementation(async (url: URL) => new Response(JSON.stringify(
  url.pathname === "/stock" ? { tickerId: symbol, industry: "Synthetic industry", financials: ["discarded"], analystView: ["not used"] } : reports,
)));
async function collected() { return new IndianFinancialProvider("test-key", request()).financials(symbol, today, now); }
describe("exact financial-source identity", () => {
  it("resolves BSE via an unambiguous same-ISIN NSE instrument, not a company-name match", () => {
    expect(financialSymbol(instrument)).toBe(symbol);
    const bse = { ...instrument, exchange: "BSE" as const, symbol: "123456" };
    expect(financialSymbol(bse, [instrument])).toBe(symbol);
    expect(financialSymbol(bse, [{ ...instrument, isin: "INE000000002" }])).toBeNull();
    expect(financialSymbol(bse, [instrument, { ...instrument, symbol: "OTHER" }])).toBeNull();
    expect(financialSymbol({ ...bse, isin: null }, [instrument])).toBeNull();
  });
  it("does not fetch any report for a mismatched or malformed identity response", async () => {
    for (const body of [{ tickerId: "OTHER", industry: "Industry" }, { companyName: "Synthetic company", industry: "Industry" }]) {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
      await expect(new IndianFinancialProvider("test-key", fetcher).financials(symbol, today, now)).rejects.toThrow(/exact NSE ticker/);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it("does not confuse missing industry metadata with a different stock identity", async () => {
    const fetcher = vi.fn().mockImplementation(async (url: URL) => new Response(JSON.stringify(
      url.pathname === "/stock" ? { tickerId: symbol, industry: null } : reports,
    )));
    const evidence = await new IndianFinancialProvider("test-key", fetcher).financials(symbol, today, now);
    expect(evidence.industry).toBe("Not provided");
    expect(evidence.status).toBe("collected");
    expect(evidence.researchReady).toBe(false);
  });
  it("only sends public symbols and the financial-source key to fixed read endpoints", async () => {
    const fetcher = request();
    await new IndianFinancialProvider("test-key", fetcher).financials(symbol, today, now);
    expect(fetcher).toHaveBeenCalledTimes(4);
    for (const [url, options] of fetcher.mock.calls) {
      expect(url.origin).toBe("https://stock.indianapi.in");
      expect(["/stock", "/historical_stats"]).toContain(url.pathname);
      expect(url.toString()).not.toContain("test-key");
      expect(options.method).toBe("GET");
      expect(options.redirect).toBe("error");
      expect(options.headers["X-Api-Key"]).toBe("test-key");
      expect(options.headers).not.toHaveProperty("Authorization");
    }
  });
});
describe("report parsing without invented metadata", () => {
  it("preserves negative values and nulls, excludes future/TTM periods and never makes period-end a publication date", () => {
    const report = parseFinancialReport(reports, "annual", today);
    expect(report.periods).toEqual([{ label: "Mar 2024", end: "2024-03-31" }, { label: "Mar 2025", end: "2025-03-31" }]);
    expect(report.ignoredPeriods).toEqual(["Mar 2027", "TTM"]);
    expect(report.rows.find((r) => r.label === "Net Profit")?.values).toEqual({ "Mar 2024": -5, "Mar 2025": null });
    expect(report.rows.find((r) => r.label === "EPS in Rs")?.values["Mar 2025"]).toBeNull();
    expect(report.periods[0]).not.toHaveProperty("availableAt");
  });
  it.each(["NaN", "Infinity", "₹100", "1,00,000", "12%", true, {}])("rejects undocumented numeric formats instead of assuming units: %j", (value) => {
    expect(() => parseFinancialReport({ Sales: { "Mar 2025": value } }, "annual", today)).toThrow();
  });
  it("rejects empty and unsupported periods rather than presenting them as reported history", () => {
    expect(() => parseFinancialReport({}, "annual", today)).toThrow();
    expect(() => parseFinancialReport({ Sales: { TTM: 100 } }, "annual", today)).toThrow();
    expect(() => parseFinancialReport({ Sales: { "Mar 2027": 100 } }, "annual", today)).toThrow();
    expect(() => parseFinancialReport(reports, "annual", "2026-02-30")).toThrow();
  });
  it("collects reports without promoting incomplete metadata to investment research readiness", async () => {
    const evidence = await collected();
    expect(Object.keys(evidence.reports)).toHaveLength(3);
    expect(evidence.status).toBe("collected");
    expect(evidence.researchReady).toBe(false);
    expect(evidence.isinVerified).toBe(false);
    expect(evidence.publicationTimesVerified).toBe(false);
    expect(evidence.unitsVerified).toBe(false);
    expect(evidence.currencyVerified).toBe(false);
    expect(evidence.consolidationVerified).toBe(false);
    expect(evidence).not.toHaveProperty("analystView");
    const analysis = analyseRadar({ candles: [{ date: "2026-11-16", open: 100, high: 100, low: 100, close: 100, volume: 100 }], asset: "equity", today, expectedSession: "2026-11-16", adjustmentsVerified: false, priceBelow: null, drawdownPct: null });
    analysis.financials = evidence;
    const result = automaticResearch({ analysis, asset: "equity", classification: classifyInstrument(instrument), isin: instrument.isin, exchange: instrument.exchange, today, now });
    expect(result.checks.find((c) => c.id === "company-reports")?.state).toBe("ready");
    expect(result.checks.find((c) => c.id === "fundamentals")?.state).toBe("missing");
    expect(result.label).toBe("Research not ready");
    expect(result.score).toBeNull();
  });
  it("retains successful reports when another report fails", async () => {
    const fetcher = vi.fn().mockImplementation(async (url: URL) => {
      if (url.pathname === "/stock") return new Response(JSON.stringify({ tickerId: symbol, industry: "Industry" }));
      return url.searchParams.get("stats") === "cashflow" ? new Response("private upstream text", { status: 500 }) : new Response(JSON.stringify(reports));
    });
    const evidence = await new IndianFinancialProvider("test-key", fetcher).financials(symbol, today, now);
    expect(evidence.status).toBe("partial");
    expect(Object.keys(evidence.reports)).toHaveLength(2);
    expect(evidence.errors).toHaveLength(1);
    expect(JSON.stringify(evidence)).not.toContain("private");
  });
});
describe("safe errors and quota reuse", () => {
  it.each([400, 401, 403, 404, 429, 500])("does not leak headers or upstream text on HTTP %s", async (status) => {
    const fetcher = vi.fn().mockResolvedValue(new Response("private test-key upstream", { status }));
    await expect(new IndianFinancialProvider("test-key", fetcher).financials(symbol, today, now)).rejects.not.toThrow(/private|test-key/);
  });
  it("handles HTTP-200 error bodies, malformed JSON and oversized responses safely", async () => {
    for (const text of [JSON.stringify({ error: "private test-key error" }), "not json", "x".repeat(2_000_001)]) {
      const fetcher = vi.fn().mockResolvedValue(new Response(text));
      await expect(new IndianFinancialProvider("test-key", fetcher).financials(symbol, today, now)).rejects.not.toThrow(/private|test-key/);
    }
  });
  it("does not send invalid input to the provider", async () => {
    const fetcher = request();
    await expect(new IndianFinancialProvider("test-key", fetcher).financials("../private", today, now)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("reuses only matching, nonfuture reports under 24 hours old, with their original retrieval time", async () => {
    const evidence = await collected();
    expect(canReuseFinancials(evidence, symbol, "2026-11-18T15:59:59Z")).toBe(true);
    expect(canReuseFinancials(evidence, symbol, "2026-11-18T16:00:00Z")).toBe(false);
    expect(canReuseFinancials(evidence, "OTHER", now)).toBe(false);
    expect(canReuseFinancials(evidence, symbol, "2026-11-17T15:59:59Z")).toBe(false);
    expect(canReuseFinancials(evidence, symbol, "bad")).toBe(false);
    expect(evidence.fetchedAt).toBe(now);
  });
});
