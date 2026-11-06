"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { formatINR, formatINRCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface NetWorthPoint {
  day: string;
  assets: number;
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
}: {
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
      className="h-28 w-full touch-none"
      role="img"
      aria-label={`Net worth from ${formatDate(points[0].day)} to ${formatDate(points[points.length - 1].day)}`}
      onPointerDown={(e) => {
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
export function NetWorthCard({ history }: { history: NetWorthPoint[] }) {
  const points = history.map((p) => ({
    day: p.day,
    value: p.assets - p.liabilities,
  }));
  const last = points.length - 1;
  const [picked, setPicked] = useState(last);
  const now = history[picked];
  const net = points[picked].value;
  const first = points[0].value;
  const change = points[last].value - first;
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
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">You own</p>
          <p className="tabular font-medium">{formatINR(now.assets)}</p>
        </div>
        <div className="border-l pl-3">
          <p className="text-xs text-muted-foreground">You owe</p>
          <p className="tabular font-medium">{formatINR(now.liabilities)}</p>
        </div>
      </div>
      {points.length > 1 ? (
        <Chart points={points} picked={picked} onPick={setPicked} />
      ) : (
        <p className="rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
          Your history starts today. Each time you add, update or remove an
          investment or loan, the chart gets a new point.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Investments and savings, minus loans. Card bills you pay in full
        aren&apos;t counted.
      </p>
    </section>
  );
}
