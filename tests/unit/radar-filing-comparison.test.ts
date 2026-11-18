import { describe, expect, it } from "vitest";
import { compareFiling, reviewedFiling, type ReviewedFiling } from "@/lib/radar/filing-comparison";
import { parseFinancialReport, type StockFinancials } from "@/lib/radar/stock-financials";
import references from "@/lib/radar/filing-references.json";
const isin = "INE000000001";
const reference = (): ReviewedFiling => ({
  isin, fiscalEnd: "2026-03-31", basis: "consolidated", source: "https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_123_28042026202149_iXBRL_WEB.html", reviewedOn: "2026-11-18", provenance: "reviewed-source-sample", valuationReady: false,
  facts: [
    ["revenue", "12000", "1200000000"], ["net-profit", "1000", "100000000"], ["operating-cash", "1100", "110000000"], ["total-assets", "10100", "1010000000"],
  ].map<ReviewedFiling["facts"][number]>(([metric, reportedValue, normalizedValue]) => ({ metric, periodEnd: "2026-03-31", periodKind: metric === "total-assets" ? "point-in-time" : "annual", basis: "consolidated", dimension: "amount", unit: "INR-lakh", reportedValue, normalizedValue })).concat([
    { metric: "diluted-eps", periodEnd: "2026-03-31", periodKind: "annual", basis: "consolidated", dimension: "per-share", unit: "INR/share", reportedValue: "1.1", normalizedValue: "1.1" },
  ] as ReviewedFiling["facts"]),
});
const evidence = (): StockFinancials => ({
  provider: "IndianAPI", source: "https://stock.indianapi.in/stock", canonicalSymbol: "SYNTHETIC", identityMatch: "same-isin", identityIsin: isin, isinVerified: false,
  industry: "Synthetic", fetchedAt: "2026-11-18T03:00:00Z", status: "collected", errors: [], publicationTimesVerified: false, unitsVerified: false, currencyVerified: false, consolidationVerified: false, researchReady: false,
  reports: {
    annual: parseFinancialReport({ Sales: { "Mar 2026": 120 }, "Net Profit": { "Mar 2026": 10 }, "EPS in Rs": { "Mar 2026": 1.2 } }, "annual", "2026-11-18"),
    balance: parseFinancialReport({ "Total Assets": { "Mar 2026": 100, "Sep 2026": 999 } }, "balance", "2026-11-18"),
    cashflow: parseFinancialReport({ "Cash from Operating Activity": { "Mar 2026": 11 } }, "cashflow", "2026-11-18"),
  },
});
describe("reviewed filing comparison without source-quality promotion", () => {
  it("shows conditional agreements and review items while retaining every verification gap", () => {
    const input = evidence(), original = structuredClone(input);
    const result = compareFiling(input, reference(), isin)!;
    expect(result.conditionalMatches).toBe(3);
    expect(result.rows.find((r) => r.label === "Total assets")?.state).toBe("needs-review");
    expect(result.rows.find((r) => r.label === "Earnings per share")?.state).toBe("definition-unverified");
    expect(result.providerScaleVerified).toBe(false);expect(result.valuationReady).toBe(false);expect(input).toEqual(original);
  });
  it("requires the expected filing and cross-source security identity", () => {
    expect(compareFiling(evidence(), reference(), "INE000000009")).toBeNull();
    const input = evidence();input.identityMatch = "exact-nse-ticker";delete input.identityIsin;
    expect(compareFiling(input, reference(), isin)!.conditionalMatches).toBe(0);
  });
  it("uses an exact period and row, never the latest interim value or an ambiguous alias", () => {
    const input = evidence();input.reports.balance!.rows[0].values["Mar 2026"] = 101;
    expect(compareFiling(input, reference(), isin)!.rows.find((r) => r.label === "Total assets")?.state).toBe("conditional-match");
    input.reports.annual!.rows.push({ label: "Sales", values: { "Mar 2026": 120 } });
    expect(compareFiling(input, reference(), isin)!.rows[0].state).toBe("unavailable");
  });
  it.each([null, Number.NaN, Infinity])("does not fill a missing or invalid source cell: %s", (value) => {
    const input = evidence();input.reports.annual!.rows[0].values["Mar 2026"] = value;
    expect(compareFiling(input, reference(), isin)!.rows[0].state).toBe("unavailable");
  });
  it("compares decimal source amounts exactly under the declared hypothesis", () => {
    const input = evidence(), ref = reference();input.reports.annual!.rows[0].values["Mar 2026"] = 0.03;
    ref.facts[0].reportedValue = "3";ref.facts[0].normalizedValue = "300000";
    expect(compareFiling(input, ref, isin)!.rows[0].state).toBe("conditional-match");
  });
  it("rejects inconsistent normalized reference amounts and any attempted ready flag", () => {
    const ref = reference();ref.facts[0].normalizedValue = "1";
    expect(compareFiling(evidence(), ref, isin)!.rows[0].state).toBe("unavailable");
    expect(compareFiling(evidence(), { ...reference(), valuationReady: true } as unknown as ReviewedFiling, isin)).toBeNull();
  });
  it("keeps reviewed reference coverage explicit and exact", () => {
    for (const ref of references) expect(reviewedFiling(ref.isin)?.source).toBe(ref.source);
    expect(reviewedFiling("INE000000009")).toBeUndefined();
    expect(reviewedFiling(null)).toBeUndefined();
  });
});
