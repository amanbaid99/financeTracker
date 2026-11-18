"use client";

import { UpdatePrices } from "@/components/update-prices";
import { useState } from "react";
import { AllocationBar, CompactAllocation } from "@/components/allocation-bar";
import { PortfolioHoldings } from "@/components/portfolio-holdings";
import { formatINR } from "@/lib/format";
import { editedDate } from "@/lib/portfolio-view";
import {
  ASSET_CLASSES,
  type AssetClass,
  type Portfolio,
} from "@/lib/portfolio";
import type { Investment, Link } from "@/lib/tracker";
import { cn } from "@/lib/utils";

/** What you put in against what it's worth now, over holdings where that's known. */
function InvestedSummary({ portfolio: p }: { portfolio: Portfolio }) {
  const g = p.growth;
  const missing = p.holdings.length - (g?.known ?? 0);
  if (!g)
    return (
      <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        Add the amount you invested to your holdings (tap one below) or import
        a CAS to see your gains and losses.
      </p>
    );
  const up = g.gain >= 0;
  return (
    <div className="mt-4 space-y-2 border-t pt-3" data-guide="invested">
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">Invested</dt>
          <dd className="tabular text-lg font-semibold">
            {formatINR(g.invested)}
          </dd>
        </div>
        <div className="border-l pl-3">
          <dt className="text-xs text-muted-foreground">
            {up ? "Gain" : "Loss"}
          </dt>
          <dd
            className={cn(
              "tabular text-lg font-semibold",
              up ? "text-success" : "text-danger",
            )}
          >
            {up ? "+" : "−"}
            {formatINR(Math.abs(g.gain))}
            <span className="ml-1 text-xs font-medium">
              {up ? "+" : "−"}
              {Math.abs(g.gainPct * 100).toFixed(1)}%
            </span>
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        {missing > 0
          ? `From ${g.known} of ${g.of} holdings, worth ${formatINR(g.value)} now. Add the invested amount to the other ${missing} to include them.`
          : `Across all ${g.of} holdings, worth ${formatINR(g.value)} now.`}{" "}
        Simple gain, not a yearly return.
      </p>
    </div>
  );
}

export function PortfolioOverview({
  portfolio: p,
  investments,
  links,
  review,
  lastImportAt,
  autoAdd = false,
}: {
  portfolio: Portfolio;
  investments: Investment[];
  links: Link[];
  review: React.ReactNode;
  lastImportAt: string | null;
  autoAdd?: boolean;
}) {
  const [assetClass, setAssetClass] = useState<AssetClass | null>(null);
  const [view, setView] = useState<"asset" | "kind">("asset");
  const kindSlot = (c: AssetClass) =>
    ASSET_CLASSES.find((x) => x.key === c)?.slot ?? 7;
  const lastEdit = investments
    .map((i) => i.updatedAt)
    .filter((v): v is string => !!v && Number.isFinite(Date.parse(v)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const imported = editedDate(lastImportAt);
  const edited = editedDate(lastEdit);
  return (
    <>
      <section
        className="surface-card rounded-2xl border border-border/70 bg-card p-4"
        aria-label="Portfolio overview"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            <p>Total value</p>
            <p>
              {p.holdings.length}{" "}
              {p.holdings.length === 1 ? "holding" : "holdings"}
            </p>
          </div>
          <UpdatePrices />
        </div>
        <p className="tabular mt-1 text-3xl font-semibold tracking-tight">
          {formatINR(p.total)}
        </p>
        {p.monthlySips > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {formatINR(p.monthlySips)} a month going in
          </p>
        )}
        <InvestedSummary portfolio={p} />
        <div data-guide="allocation" className="mt-4 border-t pt-3">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Where your money is</h2>
            <div
              className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1"
              role="tablist"
              aria-label="Group by"
            >
              {(
                [
                  ["asset", "Asset type"],
                  ["kind", "Instrument"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={view === key}
                  onClick={() => {
                    setView(key);
                    if (key === "kind") setAssetClass(null);
                  }}
                  className={cn(
                    "min-h-8 rounded-md px-2.5 text-xs",
                    view === key
                      ? "bg-card font-medium shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {view === "asset" ? (
            <AllocationBar
              classes={p.classes}
              active={assetClass}
              onSelect={setAssetClass}
            />
          ) : (
            <CompactAllocation
              label="By instrument"
              items={p.kinds.map((k) => ({
                key: k.label,
                label: k.label,
                value: k.value,
                share: k.share,
                slot: kindSlot(k.assetClass),
              }))}
            />
          )}
        </div>
        <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">
          {edited ? `Last edited ${edited}` : "Edit date unavailable"}
          {imported
            ? ` · CAS imported ${imported}`
            : " · CAS import date not recorded"}
        </p>
      </section>
      {review}
      <section
        className="surface-card overflow-hidden rounded-2xl border border-border/70 bg-card"
        aria-labelledby="holdings-h"
      >
        <PortfolioHoldings
          holdings={p.holdings}
          investments={investments}
          links={links}
          assetClass={assetClass}
          onClearClass={() => setAssetClass(null)}
          autoAdd={autoAdd}
        />
      </section>
    </>
  );
}
