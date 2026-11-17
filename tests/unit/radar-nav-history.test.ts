import { describe, expect, it, vi } from "vitest";
import { fetchNavHistory, historyWindow, parseNavHistory } from "@/lib/radar/nav-history";
const anchor = { isin: "INF000000001", schemeCode: "123", name: "Synthetic Gold ETF", nav: 100.1256, date: "2026-11-16", goldEtf: true, source: "https://portal.amfiindia.com/spages/NAVAll.txt" };
const now = "2026-11-17T04:30:00Z";
const body = {
  status: "SUCCESS",
  meta: { scheme_code: 123, isin_growth: anchor.isin, isin_div_reinvestment: null },
  data: [{ date: "16-11-2026", nav: "100.12560" }, { date: "13-11-2026", nav: "99.5" }],
};
const parse = (input: unknown = body) => parseNavHistory(input, anchor, anchor.date, now);
describe("NAV history identity and provenance", () => {
  it("matches code and exact ISIN, reconciles latest NAV and preserves decimals in chronological order", () => {
    const history = parse();
    expect(history.points).toEqual([{ date: "2026-11-13", nav: 99.5 }, { date: "2026-11-16", nav: 100.1256 }]);
    expect(history.officialCheck).toEqual({ source: anchor.source, date: anchor.date, nav: anchor.nav });
    expect(history.publicationTimesVerified).toBe(false);
    expect(history.adjustmentsVerified).toBe(false);
    expect(history.points[0]).not.toHaveProperty("availableAt");
  });
  it("accepts the exact reinvestment ISIN, never a similar scheme name", () => {
    expect(parse({ ...body, meta: { ...body.meta, isin_growth: null, isin_div_reinvestment: anchor.isin } }).isin).toBe(anchor.isin);
    expect(() => parse({ ...body, meta: { ...body.meta, isin_growth: "INF000000002" } })).toThrow(/ISIN/);
    expect(() => parse({ ...body, meta: { ...body.meta, scheme_code: 124 } })).toThrow(/scheme code/);
  });
  it("fails when latest official NAV is absent or materially different", () => {
    expect(() => parse({ ...body, data: body.data.slice(1) })).toThrow(/reconciled/);
    expect(() => parse({ ...body, data: [{ date: "16-11-2026", nav: "100.13" }] })).toThrow(/reconciled/);
  });
  it.each([
    [{ date: "31-02-2026", nav: "100" }],
    [{ date: "16-11-2026", nav: "NaN" }],
    [{ date: "16-11-2026", nav: "0" }],
    [{ date: "16-11-2026", nav: "" }],
    [{ date: "2026-11-16", nav: "100" }],
    [{ date: "16-11-2026", nav: "1e2" }],
  ])("rejects malformed historical observations: %j", (row) => {
    expect(() => parse({ ...body, data: [row, ...body.data] })).toThrow();
  });
  it("rejects duplicate dates even when values agree", () => {
    expect(() => parse({ ...body, data: [...body.data, body.data[0]] })).toThrow(/duplicate/);
  });
  it("excludes dates outside the bounded completed-session window", () => {
    expect(parse({ ...body, data: [...body.data, { date: "17-11-2026", nav: "101" }, { date: "01-01-2010", nav: "10" }] }).points).toHaveLength(2);
    expect(historyWindow(anchor.date)).toEqual({ start: "2025-05-15", end: "2026-11-16" });
  });
  it("never requests a scheme until its official same-session identity is valid", async () => {
    const request = vi.fn();
    for (const changed of [{ ...anchor, schemeCode: "../private" }, { ...anchor, date: "2026-11-13" }, { ...anchor, nav: NaN }]) {
      await expect(fetchNavHistory(changed, anchor.date, now, request)).rejects.toThrow();
    }
    expect(request).not.toHaveBeenCalled();
    expect(() => parseNavHistory(body, anchor, anchor.date, "2026-11-16T05:00:00Z")).toThrow(/retrieval time/);
  });
});
describe("bounded secondary-source requests", () => {
  it("sends only a public scheme code and date range with no broker credentials", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
    const result = await fetchNavHistory(anchor, anchor.date, now, request);
    const [url, options] = request.mock.calls[0];
    expect(url.origin).toBe("https://api.mfapi.in");
    expect(url.pathname).toBe("/mf/123");
    expect(url.searchParams.get("startDate")).toBe("2025-05-15");
    expect(url.searchParams.get("endDate")).toBe(anchor.date);
    expect(options).toMatchObject({ method: "GET", redirect: "error", cache: "no-store", headers: { Accept: "application/json" } });
    expect(JSON.stringify(options)).not.toMatch(/Authorization|token|ISIN|name/);
    expect(result.points).toHaveLength(2);
  });
  it("does not expose raw upstream responses or thrown network messages", async () => {
    for (const request of [
      vi.fn().mockRejectedValue(new Error("private upstream error")),
      vi.fn().mockResolvedValue(new Response("private upstream body", { status: 429 })),
      vi.fn().mockResolvedValue(new Response("not json")),
    ]) await expect(fetchNavHistory(anchor, anchor.date, now, request)).rejects.not.toThrow(/private/);
  });
  it("rejects oversized payloads and empty/unsupported responses", async () => {
    for (const response of [new Response("x".repeat(1_000_001)), new Response(null), new Response("{}")]) {
      await expect(fetchNavHistory(anchor, anchor.date, now, vi.fn().mockResolvedValue(response))).rejects.toThrow();
    }
  });
});
