"use client";

import { useState } from "react";
import { formatDate, formatINR, formatINRCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

const W = 320;
const H = 96;
const PAD = 8;

/**
 * One series over time, scaled to its own range so small moves show.
 * Tap the chart to read a day; "Today" returns to the latest.
 */
export function TrendChart({
  title,
  points,
  color,
  goodWhen = "up",
}: {
  title: string;
  points: { day: string; value: number }[];
  /** CSS colour, e.g. "var(--success)". */
  color: string;
  /** Whether a rise is good (net worth, assets) or bad (what you owe). */
  goodWhen?: "up" | "down";
}) {
  const last = points.length - 1;
  const [sel, setSel] = useState<number | null>(null);
  if (!points.length) return null;
  const i = sel ?? last;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.max(1, Math.abs(hi) * 0.05);
  const min = lo - span * 0.15;
  const max = hi + span * 0.15;
  const x = (k: number) =>
    points.length === 1 ? W / 2 : PAD + (k * (W - PAD * 2)) / last;
  const y = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);
  const line = points
    .map(
      (p, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(p.value).toFixed(1)}`,
    )
    .join(" ");
  const change = points[last].value - points[0].value;
  const good = goodWhen === "up" ? change > 0 : change < 0;
  const signed = (n: number) => `${n < 0 ? "−" : ""}${formatINR(Math.abs(n))}`;
  return (
    <section
      className="surface-card space-y-2 rounded-2xl border border-border/70 bg-card p-4"
      aria-label={title}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs text-muted-foreground">
          {title}
          {sel !== null && sel !== last && ` on ${formatDate(points[i].day)}`}
        </h2>
        {sel !== null && sel !== last ? (
          <button
            type="button"
            onClick={() => setSel(null)}
            className="min-h-8 text-xs font-medium text-primary"
          >
            Today
          </button>
        ) : (
          points.length > 1 && (
            <span
              className={cn(
                "tabular text-xs font-medium",
                change === 0
                  ? "text-muted-foreground"
                  : good
                    ? "text-success"
                    : "text-danger",
              )}
            >
              {change === 0
                ? "No change"
                : `${change > 0 ? "+" : "−"}${formatINRCompact(Math.abs(change))}`}{" "}
              since {formatDate(points[0].day)}
            </span>
          )
        )}
      </div>
      <p className="tabular text-2xl font-semibold tracking-tight">
        {signed(points[i].value)}
      </p>
      {points.length > 1 ? (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-24 w-full touch-pan-y"
            role="img"
            aria-label={`${title} from ${formatDate(points[0].day)} to ${formatDate(points[last].day)}`}
            onClick={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const rel = ((e.clientX - box.left) / box.width) * W;
              let best = 0;
              points.forEach((_, k) => {
                if (Math.abs(x(k) - rel) < Math.abs(x(best) - rel)) best = k;
              });
              setSel(best);
            }}
          >
            <path
              d={`${line} L${x(last).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`}
              fill={color}
              opacity={0.12}
            />
            <path
              d={line}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={x(i)}
              cy={y(points[i].value)}
              r={4}
              fill="var(--card)"
              stroke={color}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{formatDate(points[0].day)}</span>
            <span>{formatDate(points[last].day)}</span>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          History starts today. The chart fills in as values change.
        </p>
      )}
    </section>
  );
}
