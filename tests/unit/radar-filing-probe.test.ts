import { describe, expect, it, vi } from "vitest";
import { fetchFilingSample } from "../../scripts/radar/filing-probe.mjs";
const target = { name: "synthetic-filing", url: "https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_123456_28042026202149_iXBRL_WEB.html", expectedIsin: "INE000000001" };
const now = "2026-11-17T18:00:00Z";
describe("bounded public filing source probe", () => {
  it("records source provenance and a digest, without claiming parsed facts or publication time", async () => {
    const request = vi.fn().mockResolvedValue(new Response(`<html>${target.expectedIsin}</html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
    const result = await fetchFilingSample(target, now, request);
    expect(result.metadata.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.metadata.publicationTimeVerified).toBe(false);expect(result.metadata.parserVerified).toBe(false);
    const options = request.mock.calls[0][1];expect(options.redirect).toBe("error");expect(options.headers).toEqual({ Accept: "text/html, application/xhtml+xml" });
  });
  it.each(["https://other.example/filing.html", "http://nsearchives.nseindia.com/filing.html", `${target.url}?key=private`, "https://user:private@nsearchives.nseindia.com/filing.html"])("rejects unsupported URLs before any network access: %s", async (url) => {
    const request = vi.fn();await expect(fetchFilingSample({ ...target, url }, now, request)).rejects.toThrow(/outside the approved/);expect(request).not.toHaveBeenCalled();
  });
  it("rejects HTML challenge pages and mismatched issuer documents", async () => {
    const request = vi.fn().mockResolvedValue(new Response("<html>challenge</html>", { headers: { "Content-Type": "text/html" } }));
    await expect(fetchFilingSample(target, now, request)).rejects.toThrow(/expected security/);
  });
  it("bounds response sizes and rejects unexpected document types", async () => {
    for (const response of [new Response("x".repeat(4_000_001), { headers: { "Content-Type": "text/html" } }), new Response("%PDF", { headers: { "Content-Type": "application/pdf" } })]) {
      await expect(fetchFilingSample(target, now, vi.fn().mockResolvedValue(response))).rejects.toThrow();
    }
  });
  it("does not expose an upstream error body", async () => {
    const request = vi.fn().mockResolvedValue(new Response("private upstream text", { status: 403 }));
    await expect(fetchFilingSample(target, now, request)).rejects.toThrow("HTTP 403");
    await expect(fetchFilingSample(target, now, vi.fn().mockRejectedValue(new Error("private upstream text")))).rejects.not.toThrow(/private/);
  });
});
