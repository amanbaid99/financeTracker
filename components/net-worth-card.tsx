import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatDate, formatINR, formatINRCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface NetWorthPoint {
  day: string;
  assets: number;
  /** What's owed on loans. */
  liabilities: number;
}

/** "−₹1,79,483" for a negative amount. */
export const signedINR = (n: number) =>
  `${n < 0 ? "−" : ""}${formatINR(Math.abs(n))}`;

/** Today's net worth at a glance; the history lives on its own page. */
export function NetWorthCard({ history }: { history: NetWorthPoint[] }) {
  if (!history.length) return null;
  const now = history[history.length - 1];
  const net = now.assets - now.liabilities;
  const first = history[0];
  const change = net - (first.assets - first.liabilities);
  const total = now.assets + now.liabilities || 1;
  return (
    <section
      aria-labelledby="nw-h"
      className="surface-card space-y-3 rounded-2xl border border-border/70 bg-card p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="nw-h" className="text-xs text-muted-foreground">
          Net worth
        </h2>
        {history.length > 1 && change !== 0 && (
          <span
            className={cn(
              "tabular text-xs font-medium",
              change > 0 ? "text-success" : "text-danger",
            )}
          >
            {change > 0 ? "+" : "−"}
            {formatINRCompact(Math.abs(change))} since {formatDate(first.day)}
          </span>
        )}
      </div>
      <p className="tabular -mt-2 text-3xl font-semibold tracking-tight">
        {signedINR(net)}
      </p>
      <div
        className="flex h-2 gap-0.5 overflow-hidden rounded-full"
        aria-hidden
      >
        {now.assets > 0 && (
          <span
            className="h-full bg-success"
            style={{ width: `${(now.assets / total) * 100}%` }}
          />
        )}
        {now.liabilities > 0 && (
          <span
            className="h-full bg-danger"
            style={{ width: `${(now.liabilities / total) * 100}%` }}
          />
        )}
      </div>
      <dl className="space-y-1 text-sm">
        {(
          [
            ["You own", now.assets, "bg-success"],
            ["You owe on loans", now.liabilities, "bg-danger"],
          ] as const
        ).map(([label, value, color]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3"
          >
            <dt className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", color)} aria-hidden />
              {label}
            </dt>
            <dd className="tabular font-medium">{formatINR(value)}</dd>
          </div>
        ))}
      </dl>
      <Link
        href="/portfolio/net-worth"
        className="-mb-1 flex min-h-11 items-center justify-between border-t pt-1 text-sm font-medium text-primary"
      >
        See progress over time
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
