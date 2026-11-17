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
  const sources = result.blockers.filter((b) => b.owner === "source");
  const development = result.blockers.filter((b) => b.owner === "development");
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
      </div>
      <details id="research-data" className="border-t pt-1">
        <summary className="min-h-11 flex items-center cursor-pointer text-sm font-medium">
          Data checks and limitations
        </summary>
        {(sources.length > 0 || development.length > 0) && (
          <div className="rounded-xl bg-muted/50 p-3 text-sm space-y-2">
            {sources.length > 0 && (
              <p>
                <span className="font-medium">Data sources needed: </span>
                {sources.map((b) => b.label).join(", ")}.
              </p>
            )}
            {development.length > 0 && (
              <p>
                <span className="font-medium">Still being tested or built: </span>
                {development.map((b) => b.label).join(", ")}.
              </p>
            )}
          </div>
        )}
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
                      : c.id === "model"
                        ? (result.goldStudy || result.stockStudy ? "In testing" : "To build")
                        : "Needs data"}
                </span>
              </div>
              <p className="text-muted-foreground text-xs mt-0.5">{c.detail}</p>
            </li>
          ))}
        </ul>
        {result.goldStudy && (
          <div className="mt-4 border-t pt-3 space-y-2">
            <p className="font-medium text-sm">Gold model: paper testing</p>
            <p className="text-xs text-muted-foreground">
              The calculation code is implemented. It has not passed historical
              validation or live monitoring. No paper decision is a live
              recommendation.
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
              {result.goldStudy.missing.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}
        {result.stockStudy && (
          <div className="mt-4 border-t pt-3 space-y-2">
            <p className="font-medium text-sm">Stock model: paper testing</p>
            <p className="text-xs text-muted-foreground">
              The calculation code is implemented for profitable non-financial businesses.
              It has not passed historical validation or live monitoring. Financial
              companies and loss-making businesses need separate models. No paper
              score or decision is a live recommendation.
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
              {result.stockStudy.missing.map((message) => <li key={message}>{message}</li>)}
            </ul>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          {result.version}. No forecast or opportunity score is implied by
          completed data checks.
        </p>
      </details>
      <p className="text-xs text-muted-foreground">
        Research only. No orders are placed.
      </p>
    </section>
  );
}
