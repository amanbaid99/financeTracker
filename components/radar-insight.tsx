import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Insight } from "@/lib/radar/insight";
import { cn } from "@/lib/utils";

export const leanClass = (tone: Insight["tone"]) =>
  tone === "good"
    ? "bg-success-soft text-success"
    : tone === "bad"
      ? "bg-warning-soft text-warning"
      : "bg-muted text-muted-foreground";

/** The experimental lean with every reason behind it. */
export function RadarInsight({ insight }: { insight: Insight }) {
  return (
    <section
      aria-labelledby="insight-h"
      className="surface-card space-y-3 rounded-2xl border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="insight-h"
            className="text-xs font-medium text-muted-foreground"
          >
            Experimental insight
          </h2>
          <p className="mt-0.5 text-xl font-semibold leading-snug">
            {insight.lean}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
            leanClass(insight.tone),
          )}
        >
          {insight.score > 0 ? `+${insight.score}` : insight.score} signals
        </span>
      </div>
      <p className="text-sm">{insight.summary}</p>
      {insight.points.length > 0 && (
        <ul className="space-y-2 border-t pt-3">
          {insight.points.map((p) => {
            const Icon =
              p.tone > 0 ? TrendingUp : p.tone < 0 ? TrendingDown : Minus;
            return (
              <li key={p.text} className="flex gap-2 text-sm">
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    p.tone > 0
                      ? "text-success"
                      : p.tone < 0
                        ? "text-warning"
                        : "text-muted-foreground",
                  )}
                  aria-label={
                    p.tone > 0
                      ? "Positive"
                      : p.tone < 0
                        ? "Negative"
                        : "Neutral"
                  }
                />
                <span>{p.text}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {insight.asOf ? `From the close on ${formatDate(insight.asOf)}. ` : ""}A
        simple read of price trend, momentum, range and, when available, the
        fund&apos;s value or the company check. It isn&apos;t a tested model,
        and it&apos;s not investment advice.
      </p>
    </section>
  );
}
