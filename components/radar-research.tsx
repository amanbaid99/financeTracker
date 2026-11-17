import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ResearchResult } from "@/lib/radar/research";

export function RadarResearch({
  result,
  onRefresh,
  pending,
  connected,
}: {
  result: ResearchResult;
  onRefresh: () => void;
  pending: boolean;
  connected: boolean;
}) {
  const ready = result.checks.filter((c) => c.state === "ready").length;
  return (
    <section
      className="rounded-2xl border bg-card p-4 space-y-3"
      aria-label="Automatic research"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Automatic research</h2>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium",
            result.label === "Wait"
              ? "bg-warning-soft text-warning"
              : "bg-muted text-muted-foreground",
          )}
        >
          {result.label}
        </span>
      </div>
      <p className="text-sm">{result.summary}</p>
      {result.asOf && (
        <p className="text-xs text-muted-foreground">
          Closing-session data: {formatDate(result.asOf)}
        </p>
      )}
      {result.reasons.length > 0 && (
        <ul className="list-disc pl-5 text-sm space-y-1">
          {result.reasons.slice(0, 3).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">{result.nextStep}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !connected}
          onClick={onRefresh}
        >
          <RefreshCw className="size-4" aria-hidden />
          {pending ? "Refreshing…" : "Refresh research"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {ready} of {result.checks.length} checks ready
        </span>
      </div>
      <details id="research-data" className="border-t pt-1">
        <summary className="min-h-11 flex items-center cursor-pointer text-sm font-medium">
          Data checks and limitations
        </summary>
        <ul className="space-y-3 text-sm">
          {result.checks.map((c) => (
            <li key={c.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{c.label}</span>
                <span
                  className={cn(
                    "text-xs shrink-0",
                    c.state === "ready"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {c.state === "ready"
                    ? "Ready"
                    : c.state === "risk"
                      ? "Needs care"
                      : "Missing"}
                </span>
              </div>
              <p className="text-muted-foreground text-xs mt-0.5">{c.detail}</p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-3">
          {result.version}. No forecast or opportunity score is implied by
          completed data checks.
        </p>
      </details>
      <p className="text-xs text-muted-foreground">
        No manual price settings are needed. A watchlist alone does not
        establish that you own an investment or should sell it.
      </p>
    </section>
  );
}
