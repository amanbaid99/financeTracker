"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { formatINR, formatINRCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface NetWorthPoint {
  day: string;
  assets: number;
  /** What's owed on loans. */
  liabilities: number;
}

const W = 320;
const H = 120;
const PAD = 6;

/** A small line chart of net worth, with a dot you can move by tapping. */
function Chart({
  points,
  picked,
  onPick,
  compact = false,
}: {
  compact?: boolean;
  points: { day: string; value: number }[];
  picked: number;
  onPick: (i: number) => void;
}) {
  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const x = (i: number) =>
    points.length === 1
      ? W / 2
      : PAD + (i * (W - PAD * 2)) / (points.length - 1);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
  const line = points
    .map(
      (p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const zero = min < 0 ? y(0) : null;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("w-full touch-pan-y", compact ? "h-20" : "h-28")}
      role="slider"
      tabIndex={0}
      aria-valuemin={0}
      aria-valuemax={points.length - 1}
      aria-valuenow={picked}
      aria-valuetext={`${formatDate(points[picked].day)}: ${formatINR(points[picked].value)}`}
      onKeyDown={(event) => {
        const next =
          event.key === "ArrowLeft"
            ? picked - 1
            : event.key === "ArrowRight"
              ? picked + 1
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? points.length - 1
                  : null;
        if (next !== null) {
          event.preventDefault();
          onPick(Math.max(0, Math.min(points.length - 1, next)));
        }
      }}
      aria-label={`Net worth from ${formatDate(points[0].day)} to ${formatDate(points[points.length - 1].day)}`}
      onClick={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        const rel = ((e.clientX - box.left) / box.width) * W;
        let best = 0;
        points.forEach((_, i) => {
          if (Math.abs(x(i) - rel) < Math.abs(x(best) - rel)) best = i;
        });
        onPick(best);
      }}
    >
      <defs>
        <linearGradient id="nw-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {zero !== null && (
        <line
          x1={0}
          x2={W}
          y1={zero}
          y2={zero}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
      )}
      {points.length > 1 && <path d={area} fill="url(#nw-fill)" />}
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={x(picked)}
        cy={y(points[picked].value)}
        r={4}
        fill="var(--card)"
        stroke="var(--primary)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** What you own minus what you owe, and how it has moved. */
export function NetWorthCard({
  history,
  compact = false,
}: {
  history: NetWorthPoint[];
  compact?: boolean;
}) {
  const points = history.map((p) => ({
    day: p.day,
    value: p.assets - p.liabilities,
  }));
  const last = points.length - 1;
  const [selection, setPicked] = useState<number | null>(null);
  if (!history.length) return null;
  const picked = Math.min(selection ?? last, last);
  const now = history[picked];
  const net = points[picked].value;
  const first = points[0].value;
  const change = points[last].value - first;
  // A flat line says nothing; wait until the value has actually moved.
  // Two points draw a line, not a trend, so wait for a few days of history.
  const moved = points.length >= 3 && points.some((p) => p.value !== first);
  return (
    <section
      aria-labelledby="nw-h"
      className="surface-card space-y-3 rounded-2xl border border-border/70 bg-card p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="nw-h" className="text-xs text-muted-foreground">
          Net worth
          {picked !== last && ` on ${formatDate(now.day)}`}
        </h2>
        {points.length > 1 && change !== 0 && (
          <span
            className={cn(
              "tabular text-xs font-medium",
              change > 0 ? "text-success" : "text-danger",
            )}
          >
            {change > 0 ? "+" : "−"}
            {formatINRCompact(Math.abs(change))} since{" "}
            {formatDate(points[0].day)}
          </span>
        )}
      </div>
      <p className="tabular -mt-2 text-3xl font-semibold tracking-tight">
        {net < 0 ? "−" : ""}
        {formatINR(Math.abs(net))}
      </p>
      <OwnOwe point={now} />
      {picked !== last && (
        <button
          type="button"
          onClick={() => setPicked(null)}
          className="-mt-1 min-h-9 text-xs font-medium text-primary"
        >
          Back to today
        </button>
      )}
      {moved ? (
        <Chart
          points={points}
          picked={picked}
          onPick={setPicked}
          compact={compact}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          {points.length < 3
            ? "A chart appears after a few days of history."
            : `No change since ${formatDate(points[0].day)}. A chart appears once it moves.`}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Investments and savings, minus loans.
      </p>
    </section>
  );
}

/** What you own against what you owe on loans: one bar, then the amounts. */
function OwnOwe({ point }: { point: NetWorthPoint }) {
  const total = point.assets + point.liabilities || 1;
  const rows = [
    { label: "You own", value: point.assets, color: "bg-success" },
    { label: "You owe on loans", value: point.liabilities, color: "bg-danger" },
  ];
  return (
    <div className="space-y-2">
      <div
        className="flex h-2 gap-0.5 overflow-hidden rounded-full"
        aria-hidden
      >
        {rows
          .filter((r) => r.value > 0)
          .map((r) => (
            <span
              key={r.label}
              className={cn("h-full", r.color)}
              style={{ width: `${(r.value / total) * 100}%` }}
            />
          ))}
      </div>
      <dl className="space-y-1 text-sm">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-baseline justify-between gap-3"
          >
            <dt className="flex items-center gap-2">
              <span
                className={cn("size-2 rounded-full", r.color)}
                aria-hidden
              />
              {r.label}
            </dt>
            <dd className="tabular font-medium">{formatINR(r.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
