"use client";

import Link from "next/link";
import { Plus, Radar, Search, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/sheet";
import { Field } from "@/components/forms/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addRadar, searchRadar } from "@/lib/radar/actions";
import {
  assetLabels,
  assetTypes,
  marketPrice,
  type RadarAsset,
  type RadarInstrument,
  type RadarSnapshot,
  type WatchItem,
} from "@/lib/radar/contracts";
import { formatDate } from "@/lib/format";

export function RadarWorkspace({
  items,
  snapshots,
  connection,
}: {
  items: WatchItem[];
  snapshots: Pick<RadarSnapshot, "watchId" | "analysis">[];
  connection: { ok: boolean; error?: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RadarInstrument[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<RadarInstrument | null>(null);
  const [asset, setAsset] = useState<RadarAsset>("equity");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function close() {
    setOpen(false);
    setSelected(null);
    setResults([]);
    setQuery("");
    setSearched(false);
    setError("");
  }
  return (
    <div className="space-y-5">
      <section
        data-guide="radar-connection"
        className="rounded-2xl border bg-card p-4 space-y-2"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          Only you can access Radar
        </div>
        <p className="text-sm text-muted-foreground">
          {connection.ok
            ? "INDmoney is connected for instrument search. Add an instrument, then refresh its daily history."
            : connection.error}
        </p>
        <p className="text-xs text-muted-foreground">
          Research only. Live buying signals and Telegram delivery are not
          enabled yet.
        </p>
        <Link
          href="/radar/setup"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
        >
          Connection and data checks
        </Link>
      </section>
      <section className="space-y-3" data-guide="radar-watchlist">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            My watchlist{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {items.length}/30
            </span>
          </h2>
          <Button
            size="sm"
            disabled={!connection.ok || items.length >= 30}
            onClick={() => setOpen(true)}
          >
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </div>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-center space-y-2">
            <Radar className="size-7 mx-auto text-primary" aria-hidden />
            <p className="font-medium">Keep an eye on what interests you</p>
            <p className="text-sm text-muted-foreground">
              Add a stock, Gold ETF or index ETF. Watchlist items stay separate
              from your investments and net worth.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const snapshot = snapshots.find((s) => s.watchId === item.id);
              return (
                <li key={item.id}>
                  <Link
                    href={`/radar/${item.id}`}
                    className="press block rounded-2xl border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold break-words">
                          {item.symbol}
                        </p>
                        <p className="text-xs text-muted-foreground break-words">
                          {item.name}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {item.exchange}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm">
                        {assetLabels[item.assetType]}
                      </span>
                      <span className="text-xs rounded-full bg-muted px-2 py-1 text-muted-foreground">
                        {snapshot ? "Insufficient data" : "History not fetched"}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="tabular text-xl font-semibold">
                        {snapshot?.analysis.close != null
                          ? marketPrice(snapshot.analysis.close)
                          : "Price unavailable"}
                      </span>
                      {snapshot?.analysis.asOf && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(snapshot.analysis.asOf)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {snapshot
                        ? "Completed-session price. Data quality checks are pending."
                        : "Open to fetch daily prices and review data checks."}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {open && (
        <Sheet
          title={selected ? "Add to watchlist" : "Find an instrument"}
          onClose={close}
        >
          {selected ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  setError("");
                  const res = await addRadar({
                    ...selected,
                    assetType: asset,
                    priceBelow: null,
                    drawdownPct: null,
                  });
                  if (!res.ok) setError(res.error ?? "Couldn't save.");
                  else {
                    close();
                    router.refresh();
                  }
                });
              }}
            >
              <div>
                <p className="font-semibold">{selected.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selected.exchange} · {selected.symbol}
                  {selected.isin ? ` · ${selected.isin}` : ""}
                </p>
              </div>
              <Field
                label="What kind of investment is it?"
                htmlFor="radar-asset"
                hint="Choose its asset type. ETF names alone are not used to guess what it tracks."
              >
                <Select
                  id="radar-asset"
                  value={asset}
                  onChange={(e) => setAsset(e.target.value as RadarAsset)}
                >
                  {assetTypes.map((a) => (
                    <option key={a} value={a}>
                      {assetLabels[a]}
                    </option>
                  ))}
                </Select>
              </Field>
              <p className="text-sm text-muted-foreground">
                This adds a research watchlist item. It does not add an
                investment or place a trade.
              </p>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Add to watchlist"}
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setSelected(null);
                    setError("");
                  }}
                >
                  Back to results
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    setError("");
                    setResults([]);
                    setSearched(false);
                    const result = await searchRadar(query);
                    if (!result.ok) setError(result.error);
                    else {
                      setResults(result.items);
                      setSearched(true);
                    }
                  });
                }}
              >
                <Input
                  aria-label="Search name, symbol or ISIN"
                  placeholder="Name, symbol or ISIN"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
                <Button type="submit" disabled={pending}>
                  <Search className="size-4" aria-hidden />
                  <span className="sr-only">Search</span>
                </Button>
              </form>
              {pending && (
                <p role="status" className="text-sm text-muted-foreground">
                  Searching INDmoney…
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              {searched && !results.length && (
                <p className="text-sm text-muted-foreground">
                  No supported instruments found. Try the exchange symbol or
                  ISIN.
                </p>
              )}
              <ul className="divide-y">
                {results.map((i) => (
                  <li key={`${i.exchange}:${i.securityId}`}>
                    <button
                      type="button"
                      className="w-full min-h-14 py-3 text-left space-y-1"
                      onClick={() => {
                        setSelected(i);
                        setError("");
                      }}
                    >
                      <span className="block font-medium break-words">
                        {i.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {i.exchange} · {i.symbol}
                        {i.isin ? ` · ${i.isin}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Results are matching instruments, not recommendations.
              </p>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
