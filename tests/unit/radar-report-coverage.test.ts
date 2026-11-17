import { describe, expect, it } from "vitest";
import { stockReportCoverage } from "@/lib/radar/report-coverage";
import { parseFinancialReport, type StockFinancials } from "@/lib/radar/stock-financials";
const values = { "Mar 2024": 10, "Mar 2025": 20, "Mar 2026": 30 };
const evidence = (): StockFinancials => ({
  provider: "IndianAPI", source: "https://stock.indianapi.in/stock", canonicalSymbol: "SYNTHETIC", identityMatch: "exact-nse-ticker", isinVerified: false,
  industry: "Synthetic industry", fetchedAt: "2026-11-17T12:00:00Z", status: "collected", errors: [],
  publicationTimesVerified: false, unitsVerified: false, currencyVerified: false, consolidationVerified: false, researchReady: false,
  reports: {
    annual: parseFinancialReport({ Sales: values, "Net Profit": values, "EPS in Rs": values, "Operating Profit": values }, "annual", "2026-11-17"),
    balance: parseFinancialReport({ Borrowings: { ...values, "Sep 2026": 40 }, "Other Assets": values, Investments: values }, "balance", "2026-11-17"),
    cashflow: parseFinancialReport({ "Cash from Operating Activity": values, "Cash from Investing Activity": values, "Free Cash Flow": values }, "cashflow", "2026-11-17"),
  },
});
describe("raw report coverage without fabricated canonical fields", () => {
  it("aligns exact shared annual periods, leaving newer interim balances separate", () => {
    const result = stockReportCoverage(evidence());
    expect(result.sharedPeriods).toEqual(["2024-03-31", "2025-03-31", "2026-03-31"]);
    expect(result.consecutiveYears).toBe(true);expect(result.valuationReady).toBe(false);
    expect(result.fields.find((f) => f.id === "revenue")?.state).toBe("collected");
  });
  it("never treats investing cash flow or free cash flow as capital spending", () => {
    expect(stockReportCoverage(evidence()).fields.find((f) => f.id === "capitalSpending")?.state).toBe("absent");
  });
  it("never treats investments/other assets as cash, or operating profit as verified EBITDA", () => {
    const fields = stockReportCoverage(evidence()).fields;
    expect(fields.find((f) => f.id === "cash")?.state).toBe("absent");
    expect(fields.find((f) => f.id === "ebitda")?.state).toBe("absent");
  });
  it("rejects ambiguous aliases instead of choosing the more favourable revenue row", () => {
    const input = evidence();input.reports.annual!.rows.push({ label: "Revenue from operations", values: { ...values, "Mar 2026": 999 } });
    expect(stockReportCoverage(input).fields.find((f) => f.id === "revenue")?.state).toBe("ambiguous");
  });
  it.each([null, undefined, Number.NaN, Infinity])("does not replace a missing or invalid cell with zero: %s", (value) => {
    const input = evidence();input.reports.annual!.rows[0].values["Mar 2026"] = value as number | null;
    expect(stockReportCoverage(input).fields.find((f) => f.id === "revenue")?.state).toBe("incomplete");
  });
  it("keeps valid zero and negative reported values, without promoting them to approved financials", () => {
    const input = evidence();input.reports.annual!.rows[0].values["Mar 2026"] = 0;
    input.reports.annual!.rows[1].values["Mar 2026"] = -5;
    const result = stockReportCoverage(input);expect(result.fields.find((f) => f.id === "profit")?.state).toBe("collected");
    expect(result.fields.find((f) => f.id === "revenue")?.state).toBe("collected");expect(result.valuationReady).toBe(false);
  });
  it("handles partial collections and never manufactures annual coverage", () => {
    const input = evidence();delete input.reports.cashflow;
    const result = stockReportCoverage(input);expect(result.sharedPeriods).toEqual([]);expect(result.consecutiveYears).toBe(false);
    expect(result.fields.find((f) => f.id === "operatingCash")?.state).toBe("absent");
  });
  it("does not collapse duplicate period-end labels or fill missing years", () => {
    const input = evidence();input.reports.balance!.periods.push({ label: "MAR 2026", end: "2026-03-31" });
    expect(stockReportCoverage(input).sharedPeriods).toEqual(["2024-03-31", "2025-03-31"]);
    expect(stockReportCoverage(input).consecutiveYears).toBe(false);
  });
});
