import { describe, expect, it, vi } from "vitest";
import { alignHistory } from "@/lib/radar/history-alignment";
import { DepthUnavailableError, parseDepth } from "@/lib/radar/etf-data";
import { IndmoneyProvider } from "@/lib/radar/indmoney";
import { collectEtfEvidence, collectMarketEvidence } from "@/lib/radar/etf-evidence";
const rows = (dates: string[]) => dates.map((date) => ({ date }));
const nav = (dates: string[]) => ({ points: dates.map((date) => ({ date, nav: 100 })) });
describe("history date reconciliation", () => {
  it("reproduces 374 prices / 373 NAV observations as 371 common dates, never one missing row", () => {
    const priceOnly = ["2025-09-29", "2025-10-21", "2026-11-08"];
    const navOnly = ["2025-05-15", "2026-03-31"];
    const common: string[] = [];
    for (let day = Date.parse("2025-05-16"); common.length < 370; day += 86400000) {
      const date = new Date(day).toISOString().slice(0, 10);
      if (![...priceOnly, ...navOnly].includes(date)) common.push(date);
    }
    common.push("2026-11-16");
    const prices = rows([...common, ...priceOnly].sort());
    const navs = nav([...common, ...navOnly].sort());
    const before = JSON.stringify({ prices, navs });
    const result = alignHistory(prices, navs);
    expect(result).toMatchObject({ valid: true, priceCount: 374, navCount: 373, matched: 371,
      priceOnly, navOnly, outsideSharedWindow: ["2025-05-15"], sharedStart: "2025-05-16", sharedEnd: "2026-11-16" });
    expect(JSON.stringify({ prices, navs })).toBe(before);
  });
  it("does not confuse equal counts with matching dates", () => {
    const result = alignHistory(rows(["2026-11-12", "2026-11-16"]), nav(["2026-11-13", "2026-11-16"]));
    expect(result.matched).toBe(1);
    expect(result.priceOnly).toEqual(["2026-11-12"]);
    expect(result.navOnly).toEqual(["2026-11-13"]);
  });
  it("separates non-overlapping windows from missing dates inside a shared period", () => {
    const result = alignHistory(rows(["2026-11-12"]), nav(["2026-11-16"]));
    expect(result.sharedStart).toBeNull();
    expect(result.sharedEnd).toBeNull();
    expect(result.matched).toBe(0);
    expect(result.outsideSharedWindow).toEqual(["2026-11-12", "2026-11-16"]);
  });
  it.each([
    [], ["2026-11-16", "2026-11-16"], ["2026-11-16", "2026-11-13"], ["2026-02-30"], ["bad"],
  ])("rejects empty, duplicate, unordered or invalid dates: %j", (...dates) => {
    const result = alignHistory(rows(dates as string[]), nav(["2026-11-16"]));
    expect(result.valid).toBe(false);
    expect(result.matched).toBe(0);
  });
});
const now = "2026-11-17T14:25:00Z";
const response = (depth: unknown[]) => ({ status: "success", data: { NSE_123: { quote_time: now, market_depth: { depth } } } });
const level = (bid = 100, ask = 101, quantity = 1) => ({ buy: { price: bid, quantity }, sell: { price: ask, quantity } });
const base = { isin: null, expectedSession: "2026-11-16", now };
describe("market-depth diagnosis without guessed timestamps", () => {
  it("uses the documented dedicated market-depth endpoint", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(response([level()]))));
    const depth = await new IndmoneyProvider("synthetic-test-token", request).depth({ exchange: "NSE", securityId: "123" }, now);
    const [url, options] = request.mock.calls[0];
    expect(url.origin).toBe("https://api.indstocks.com");
    expect(url.pathname).toBe("/market/quotes/mkt");
    expect(url.searchParams.get("scrip-codes")).toBe("NSE_123");
    expect(options.method).toBe("GET");
    expect(options.redirect).toBe("error");
    expect(depth.timestampVerified).toBe(false);
  });
  it("distinguishes an empty or one-sided book from an invalid response, without a zero spread", async () => {
    for (const levels of [[], [level(0, 0, 0)], [{ buy: { price: 100, quantity: 1 }, sell: { price: 101, quantity: 0 } }]]) {
      const readDepth = async () => parseDepth(response(levels), "NSE_123", now);
      await expect(readDepth()).rejects.toBeInstanceOf(DepthUnavailableError);
      const evidence = await collectEtfEvidence({ ...base, readDepth });
      expect(evidence.depth).toBeNull();
      expect(evidence.depthStatus?.reason).toBe("no-active-book");
      expect(evidence.depthStatus?.message).toContain("Repeated refreshes may not help");
    }
    const invalid = await collectEtfEvidence({ ...base, readDepth: async () => parseDepth(response([level(102, 100)]), "NSE_123", now) });
    expect(invalid.depthStatus?.reason).toBe("invalid-book");
  });
  it.each([[401, "access-denied"], [403, "access-denied"], [429, "rate-limited"], [500, "source-unavailable"]])("maps HTTP %s to a safe reason", async (status, reason) => {
    const request = vi.fn().mockResolvedValue(new Response("private upstream response", { status: status as number }));
    const provider = new IndmoneyProvider("synthetic-test-token", request);
    const evidence = await collectEtfEvidence({ ...base, readDepth: () => provider.depth({ exchange: "NSE", securityId: "123" }, now) });
    expect(evidence.depthStatus?.reason).toBe(reason);
    expect(JSON.stringify(evidence)).not.toContain("private");
    expect(JSON.stringify(evidence)).not.toContain("synthetic-test-token");
  });
  it("a successful untimestamped response is not verified fresh, even after a recent retrieval", async () => {
    const evidence = await collectEtfEvidence({ ...base, readDepth: async () => parseDepth(response([level()]), "NSE_123", now) });
    expect(evidence.depthStatus?.state).toBe("available-untimestamped");
    expect(evidence.depth?.timestampVerified).toBe(false);
  });
  it("does not misclassify unknown errors as proof of an empty market", async () => {
    const evidence = await collectEtfEvidence({ ...base, readDepth: async () => { throw new Error("private source details"); } });
    expect(evidence.depthStatus?.reason).toBe("source-unavailable");
    expect(evidence.depthStatus?.message).toContain("does not prove");
    expect(JSON.stringify(evidence)).not.toContain("private");
  });
});


describe("shared stock and ETF source checks", () => {
  it("collects stock depth without requiring NAV, an ISIN or Gold evidence", async () => {
    const readDepth = vi.fn().mockResolvedValue(parseDepth(response([level()]), "NSE_123", now));
    const evidence = await collectMarketEvidence(readDepth);
    expect(readDepth).toHaveBeenCalledOnce();
    expect(evidence.depthStatus?.state).toBe("available-untimestamped");
    expect(evidence).not.toHaveProperty("nav");
    expect(evidence).not.toHaveProperty("navHistory");
    expect(evidence).not.toHaveProperty("goldSources");
  });
});
