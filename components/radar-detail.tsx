"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import {
  marketPrice,
  type RadarSnapshot,
  type WatchItem,
} from "@/lib/radar/contracts";
import { refreshRadar, removeRadar, saveRadarRules } from "@/lib/radar/actions";
import { formatDate } from "@/lib/format";

function PriceChart({ snapshot }: { snapshot: RadarSnapshot }) {
  const candles = snapshot.candles;
  if (candles.length < 2)
    return (
      <p className="text-sm text-muted-foreground">
        More completed sessions are needed for a chart.
      </p>
    );
  const min = Math.min(...candles.map((c) => c.close));
  const max = Math.max(...candles.map((c) => c.close));
  const points = candles
    .map(
      (c, i) =>
        `${8 + (i / (candles.length - 1)) * 304},${112 - ((c.close - min) / (max - min || 1)) * 100}`,
    )
    .join(" ");
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground tabular">
        <span>{marketPrice(min)}</span>
        <span>{marketPrice(max)}</span>
      </div>
      <svg
        role="img"
        aria-label={`Daily closing prices from ${candles[0].date} to ${candles.at(-1)!.date}. Latest ${marketPrice(candles.at(-1)!.close)}. Corporate-action adjustments are unverified.`}
        viewBox="0 0 320 120"
        className="w-full h-36 text-primary"
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{formatDate(candles[0].date)}</span>
        <span>{formatDate(candles.at(-1)!.date)}</span>
      </div>
    </div>
  );
}

export function RadarDetail({
  item,
  snapshot,
  connected,
}: {
  item: WatchItem;
  snapshot: RadarSnapshot | null;
  connected: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState(false);
  const [price, setPrice] = useState(item.priceBelow?.toString() ?? "");
  const [dip, setDip] = useState(item.drawdownPct?.toString() ?? "");
  const router = useRouter();
  const a = snapshot?.analysis;
  function refresh() {
    start(async () => {
      setError("");
      setNotice("");
      const result = await refreshRadar(item.id);
      if (!result.ok) setError(result.error ?? "Try again.");
      else {
        setNotice("Daily history updated. Review the data checks below.");
        router.refresh();
      }
    });
  }
  const pct = (v: number | null | undefined) =>
    v == null ? "Unavailable" : `${v.toFixed(1)}%`;
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-4 space-y-4">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              Last available daily close
            </p>
            <p className="tabular text-3xl font-semibold mt-1">
              {a?.close != null ? marketPrice(a.close) : "Unavailable"}
            </p>
            {a?.asOf && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(a.asOf)} · INDstocks
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || !connected}
            onClick={refresh}
          >
            <RefreshCw className="size-4" aria-hidden />
            {pending ? "Working…" : "Refresh history"}
          </Button>
        </div>
        {snapshot && <PriceChart snapshot={snapshot} />}
        <p className="text-xs text-muted-foreground">
          {snapshot
            ? `Fetched ${formatDate(snapshot.fetchedAt.slice(0, 10))}. ${a?.sessions ?? 0} sessions. Price adjustments and exchange-calendar freshness are unverified.`
            : "Refresh to fetch daily prices. No price or buying signal is assumed."}
        </p>
      </section>
      {error && (
        <p
          role="alert"
          className="text-sm rounded-xl bg-danger-soft text-danger p-3"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-primary">
          {notice}
        </p>
      )}
      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="font-semibold">Research status</h2>
          <span className="text-xs rounded-full bg-muted px-2 py-1">
            Insufficient data
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          A price dip alone does not make an investment attractive. There is no
          opportunity score until the required inputs and model are verified.
        </p>
        {a?.observations.length ? (
          <ul className="list-disc pl-5 text-sm space-y-1">
            {a.observations.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        ) : null}
        <details>
          <summary className="min-h-11 flex items-center cursor-pointer text-sm font-medium">
            What is still needed?
          </summary>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
            {(
              a?.blockers ?? [
                "Fetch price history, then verify source quality and the asset-specific data before scoring.",
              ]
            ).map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </details>
        {a && (
          <p className="text-xs text-muted-foreground">
            Engine {a.version}. Indicators below are provisional research
            calculations.
          </p>
        )}
      </section>
      {a && (
        <section className="rounded-2xl border bg-card p-4 space-y-2">
          <h2 className="font-semibold">Price indicators</h2>
          <dl className="divide-y text-sm">
            {[
              ["Below 30-session high", pct(a.technicals.drawdown30)],
              ["Below 90-session high", pct(a.technicals.drawdown90)],
              ["Below 252-session high", pct(a.technicals.drawdown252)],
              ["RSI (14)", a.technicals.rsi14?.toFixed(1) ?? "Unavailable"],
              [
                "50-session average",
                a.technicals.sma50 == null
                  ? "Unavailable"
                  : marketPrice(a.technicals.sma50),
              ],
              [
                "200-session average",
                a.technicals.sma200 == null
                  ? "Unavailable"
                  : marketPrice(a.technicals.sma200),
              ],
              ["Annualised volatility", pct(a.technicals.volatility60)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between items-baseline gap-3 py-2.5"
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="tabular font-medium text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold">My thresholds</h2>
        <p className="text-sm text-muted-foreground">
          Save prices to watch for. Scheduled monitoring and Telegram delivery
          are not enabled yet. These thresholds do not trigger a purchase.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setError("");
              setNotice("");
              const result = await saveRadarRules({
                id: item.id,
                priceBelow: price ? Number(price) : null,
                drawdownPct: dip ? Number(dip) : null,
              });
              if (!result.ok) setError(result.error ?? "Try again.");
              else {
                setNotice(
                  "Thresholds saved. Notifications are not enabled yet.",
                );
                router.refresh();
              }
            });
          }}
        >
          <Field label="Price at or below (₹, optional)" htmlFor="radar-price">
            <Input
              id="radar-price"
              type="number"
              inputMode="decimal"
              min="0.0001"
              max="100000000"
              step="0.0001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <Field
            label="Drop from 90-session high (%, optional)"
            htmlFor="radar-dip"
          >
            <Input
              id="radar-dip"
              type="number"
              inputMode="decimal"
              min="1"
              max="80"
              step="0.01"
              value={dip}
              onChange={(e) => setDip(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="outline" disabled={pending}>
            Save thresholds
          </Button>
        </form>
      </section>
      <section className="space-y-2">
        {removing ? (
          <div className="rounded-xl border p-4 space-y-3">
            <p className="text-sm">
              Remove this watchlist item and its fetched history? Your actual
              holdings stay as they are.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await removeRadar(item.id);
                    if (!result.ok) setError(result.error ?? "Try again.");
                    else {
                      router.push("/radar");
                      router.refresh();
                    }
                  })
                }
              >
                Yes, remove
              </Button>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => setRemoving(false)}
              >
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setRemoving(true)}>
            Remove from watchlist
          </Button>
        )}
      </section>
    </div>
  );
}
