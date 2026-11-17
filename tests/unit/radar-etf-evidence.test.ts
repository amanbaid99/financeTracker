import { describe, expect, it, vi } from "vitest";
import { collectEtfEvidence } from "@/lib/radar/etf-evidence";
const isin = "INF000000001";
const navText = `Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date\nOpen Ended Schemes(Other Scheme - Gold ETF)\n123;${isin};-;Synthetic Gold ETF;100;16-Nov-2026`;
const history = { status: "SUCCESS", meta: { scheme_code: 123, isin_growth: isin }, data: [{ date: "16-11-2026", nav: "100" }] };
const base = { isin, expectedSession: "2026-11-16", now: "2026-11-17T04:30:00Z", readDepth: vi.fn().mockRejectedValue(new Error("private depth response")) };
describe("independent ETF data pipeline", () => {
  it("retains reconciled history and official NAV when market depth fails", async () => {
    const request = vi.fn().mockImplementation(async (url) => String(url).includes("NAVAll") ? new Response(navText) : new Response(JSON.stringify(history)));
    const result = await collectEtfEvidence({ ...base, request });
    expect(result.nav?.nav).toBe(100);
    expect(result.navHistory?.points).toHaveLength(1);
    expect(result.depth).toBeNull();
    expect(result.errors).toEqual(["Market spread could not be verified. Refresh to retry."]);
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("retains official NAV when history fails, without inventing history or publication times", async () => {
    const request = vi.fn().mockImplementation(async (url) => String(url).includes("NAVAll") ? new Response(navText) : new Response("private source error", { status: 429 }));
    const result = await collectEtfEvidence({ ...base, request });
    expect(result.nav?.nav).toBe(100);
    expect(result.navHistory).toBeUndefined();
    expect(result.errors.join(" ")).toContain("Historical NAV could not be checked");
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("never queries history using stale NAV, unknown session or missing ISIN", async () => {
    for (const change of [{ expectedSession: "2026-11-17" }, { expectedSession: null }, { isin: null }]) {
      const request = vi.fn().mockResolvedValue(new Response(navText));
      const result = await collectEtfEvidence({ ...base, ...change, request });
      expect(request).toHaveBeenCalledTimes(change.isin === null ? 0 : 1);
      expect(result.navHistory).toBeUndefined();
    }
  });
  it("does not convert complete upstream failure into any fresh ETF evidence", async () => {
    const request = vi.fn().mockRejectedValue(new Error("private network response"));
    const result = await collectEtfEvidence({ ...base, request });
    expect(result.nav).toBeNull();
    expect(result.depth).toBeNull();
    expect(result.navHistory).toBeUndefined();
    expect(result.errors).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("private");
  });
});
