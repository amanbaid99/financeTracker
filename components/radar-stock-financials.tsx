import Link from "next/link";
import type { StockFinancials } from "@/lib/radar/stock-financials";
import { stockReportCoverage } from "@/lib/radar/report-coverage";
import { compareFiling, reviewedFiling } from "@/lib/radar/filing-comparison";
import { todayIST } from "@/lib/dates";
import { formatDate } from "@/lib/format";

export function StockFinancialsView({ evidence, error, configured, isin }: {
  evidence?: StockFinancials;
  error?: string;
  configured: boolean;
  isin?: string | null;
}) {
  const count = evidence ? Object.keys(evidence.reports).length : 0;
  const coverage = evidence ? stockReportCoverage(evidence) : null;
  const reference = reviewedFiling(isin);
  const comparison = evidence && reference && isin ? compareFiling(evidence, reference, isin) : null;
  return (
    <details className="rounded-2xl border bg-card p-4">
      <summary className="min-h-11 flex flex-wrap items-center justify-between gap-2 cursor-pointer">
        <span className="font-semibold">Company reports</span>
        <span className="text-xs text-muted-foreground">
          {evidence ? `${count} of 3 tables collected` : !configured ? "Not connected" : error ? "Source needs checking" : "Not checked yet"}
        </span>
      </summary>
      <div className="space-y-3 pt-2 text-sm">
        {evidence ? <>
          <p className="text-muted-foreground text-xs break-words">
            IndianAPI. {evidence.identityMatch === "same-isin" ? "ISIN matched across sources" : `Exact ticker match: ${evidence.canonicalSymbol}`}. Retrieved {formatDate(todayIST(new Date(evidence.fetchedAt)))}.
          </p>
          {evidence.identityMethod === "exchange-directory" && <p className="text-xs text-muted-foreground">The source exchange directory confirms the exact NSE symbol.</p>}
          <dl className="divide-y">
            {([ ["annual", "Annual results"], ["balance", "Balance sheet"], ["cashflow", "Cash flow"] ] as const).map(([kind, label]) => {
              const report = evidence.reports[kind];
              return <div key={kind} className="flex justify-between gap-3 py-2">
                <dt>{label}</dt>
                <dd className="text-right text-muted-foreground text-xs">
                  {report ? `${report.periods.length} periods through ${formatDate(report.periods.at(-1)!.end)}` : "Unavailable"}
                </dd>
              </div>;
            })}
          </dl>
          {coverage && <div className="space-y-2 text-xs text-muted-foreground">
            <p>{coverage.sharedPeriods.length} matching year ends across all three reports{coverage.sharedPeriods.length > 0 ? `, through ${formatDate(coverage.sharedPeriods.at(-1)!)}` : ""}.</p>
            {coverage.fields.some((f) => f.state !== "collected") && <p>Still needed for valuation: {coverage.fields.filter((f) => f.state !== "collected").map((f) => f.label.toLowerCase()).join(", ")}. Missing or incomplete fields are never filled from unrelated totals.</p>}
            <p>Accounting changes and recurring earnings need review before growth or valuation can be scored.</p>
          </div>}
          {comparison && <details className="rounded-xl bg-muted/50 p-3">
            <summary className="min-h-11 cursor-pointer text-sm font-medium">Annual filing comparison</summary>
            <div className="space-y-2 pt-2 text-xs text-muted-foreground">
              <p>Year ended {formatDate(comparison.periodEnd)}. Reference reviewed {formatDate(comparison.reviewedOn)}.</p>
              <dl className="divide-y">
                {comparison.rows.map((row) => <div key={row.label} className="flex justify-between gap-3 py-2">
                  <dt>{row.label}</dt><dd className="text-right">{row.state === "conditional-match" ? "Matches at crore scale" : row.state === "needs-review" ? "Needs review" : row.state === "definition-unverified" ? "Definition needs review" : "Cannot compare"}</dd>
                </div>)}
              </dl>
              <p>This assumes the provider&apos;s amounts are in crores. It does not verify its full history, reporting basis or EPS definition. Differences need review before valuation.</p>
              <a href={comparison.source} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-primary">View exchange filing</a>
            </div>
          </details>}
          <p className="text-xs text-muted-foreground break-words">Industry reported by the source: {evidence.industry}.</p>
          <p className="text-xs text-muted-foreground">
            Report periods are fiscal period ends, not publication dates. ISIN,
            amount units, currency and consolidated/standalone basis are not
            independently verified. Figures are withheld from valuation scoring.
          </p>
          {evidence.errors.map((message) => <p className="text-xs text-muted-foreground" key={message}>{message}</p>)}
        </> : <p className="text-muted-foreground">
          {configured ? error ? "The financial-source key is configured, but this request could not verify company reports. Reports are not used in the assessment." : "Refresh research to check company reports. Access and coverage are verified during the request." : "Connect the optional financial-data source on the Radar connection page to retrieve company reports."}
        </p>}
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
        <p className="text-xs text-muted-foreground">
          New company checks can use up to five API requests. Successful and partial
          collections are reused for 24 hours with their original retrieval time.
          No financial model or recommendation is enabled by collecting reports.
        </p>
        <Link href="/radar/setup" className="inline-flex min-h-11 items-center text-primary">Financial-data connection</Link>
      </div>
    </details>
  );
}
