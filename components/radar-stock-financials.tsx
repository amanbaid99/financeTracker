import Link from "next/link";
import type { StockFinancials } from "@/lib/radar/stock-financials";
import { todayIST } from "@/lib/dates";
import { formatDate } from "@/lib/format";

export function StockFinancialsView({ evidence, error, configured }: {
  evidence?: StockFinancials;
  error?: string;
  configured: boolean;
}) {
  const count = evidence ? Object.keys(evidence.reports).length : 0;
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
            IndianAPI. Exact ticker match: {evidence.canonicalSymbol}. Retrieved {formatDate(todayIST(new Date(evidence.fetchedAt)))}.
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
