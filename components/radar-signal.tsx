import type { RuleSignal } from "@/lib/radar/rule-signal";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
export function RadarSignal({ signal }: { signal: RuleSignal }) {
  return (
    <section
      className="rounded-2xl border bg-card p-4 space-y-3"
      aria-label="Manual price alert"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Manual price alert</h2>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-sm font-semibold",
            signal.label === "Buy"
              ? "bg-primary-soft text-primary"
              : signal.label === "Sell"
                ? "bg-warning-soft text-warning"
                : "bg-muted text-muted-foreground",
          )}
        >
          {
            {
              Buy: "Entry reached",
              Hold: "Exit not reached",
              Sell: "Exit reached",
              Wait: "Watching",
              "No signal": "Off",
            }[signal.label]
          }
        </span>
      </div>
      <p className="text-sm">{signal.reason}</p>
      {signal.asOf && (
        <p className="text-xs text-muted-foreground">
          Based on the closing price for {formatDate(signal.asOf)}.
        </p>
      )}
      {signal.checks.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          {signal.checks.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        This follows rules you saved, not a full investment recommendation. No
        trade is placed.
      </p>
      <a
        href="#radar-rules"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
      >
        Edit alert levels
      </a>
      <details>
        <summary className="cursor-pointer text-sm font-medium min-h-11 flex items-center">
          What do these labels mean?
        </summary>
        <dl className="space-y-2 text-sm text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground">Buy</dt>
            <dd>
              Your entry rule was met. ETF entries also need aligned NAV and a
              fresh, narrow spread.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Hold</dt>
            <dd>
              You confirmed ownership and neither saved exit price was reached.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Sell</dt>
            <dd>
              You confirmed ownership and a saved upper or lower exit price was
              reached.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Wait / No signal</dt>
            <dd>
              No entry rule was met, a data check blocks it, or your rules are
              off.
            </dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
