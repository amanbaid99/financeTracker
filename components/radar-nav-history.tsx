import { alignHistory } from "@/lib/radar/history-alignment";
import type { Candle } from "@/lib/radar/contracts";
import type { NavHistory } from "@/lib/radar/nav-history";
import { marketPrice } from "@/lib/radar/contracts";
import { formatDate } from "@/lib/format";

export function NavHistoryView({ history, candles }: { history: NavHistory; candles: Candle[] }) {
  const alignment = alignHistory(candles, history);
  const points = history.points;
  if (!points.length) return null;
  const min = Math.min(...points.map((p) => p.nav));
  const max = Math.max(...points.map((p) => p.nav));
  const line = points.map((p, i) =>
    `${8 + i / Math.max(1, points.length - 1) * 304},${112 - (p.nav - min) / (max - min || 1) * 100}`,
  ).join(" ");
  return (
    <details className="border-t pt-1">
      <summary className="min-h-11 flex flex-wrap items-center justify-between gap-2 cursor-pointer">
        <span className="font-medium text-sm">Published NAV history</span>
        <span className="text-xs text-muted-foreground">{points.length} observations</span>
      </summary>
      <div className="space-y-2 pb-2">
        <div className="flex justify-between text-xs text-muted-foreground tabular">
          <span>{marketPrice(min)}</span><span>{marketPrice(max)}</span>
        </div>
        {points.length > 1 && (
          <svg role="img" aria-label={`Published NAV from ${points[0].date} to ${points.at(-1)!.date}. Adjustments and publication times are unverified.`}
            viewBox="0 0 320 120" className="w-full h-32 text-primary">
            <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        )}
        <div className="flex justify-between gap-3 text-xs text-muted-foreground">
          <span>{formatDate(points[0].date)}</span><span>{formatDate(points.at(-1)!.date)}</span>
        </div>
        <div className="rounded-xl bg-muted/50 p-3 text-xs space-y-2">
          <p className="font-medium">
            {alignment.valid ? `${alignment.matched} dates match the price history` : "History dates need review"}
          </p>
          {alignment.valid && (alignment.priceOnly.length > 0 || alignment.navOnly.length > 0) && (
            <>
              <p>Different download windows and valuation calendars can produce different counts. Records are matched by date, never by row position. No missing NAV is filled in.</p>
              <details>
                <summary className="min-h-11 flex items-center cursor-pointer font-medium">Show unmatched dates</summary>
                <p className="break-words">Prices only: {alignment.priceOnly.map(formatDate).join(", ") || "None"}.</p>
                <p className="break-words mt-2">NAV only: {alignment.navOnly.map(formatDate).join(", ") || "None"}.</p>
                {alignment.outsideSharedWindow.length > 0 && (
                  <p className="break-words mt-2">Outside the shared date range: {alignment.outsideSharedWindow.map(formatDate).join(", ")}.</p>
                )}
              </details>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          History from MFapi. The scheme code, ISIN and NAV for {formatDate(history.officialCheck.date)}
          {" "}were checked against AMFI. This verifies the latest matching point, not every historical value.
        </p>
        <p className="text-xs text-muted-foreground">
          Publication times and price adjustments are unverified. These NAV values
          are not total returns or proven inputs for a trading simulation.
        </p>
        <a href="https://www.mfapi.in/docs/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm text-primary">
          About the history source
        </a>
      </div>
    </details>
  );
}
