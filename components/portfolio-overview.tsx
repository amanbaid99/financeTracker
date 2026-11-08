"use client";

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
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>Total value</p>
          <p>
            {p.holdings.length}{" "}
            {p.holdings.length === 1 ? "holding" : "holdings"}
          </p>
        </div>
        <p className="tabular mt-1 text-3xl font-semibold tracking-tight">
          {formatINR(p.total)}
        </p>
        {p.monthlySips > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {formatINR(p.monthlySips)} a month going in
          </p>
        )}
        <div className="mt-4 border-t pt-3">
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
        <p className="border-t pt-2 text-[11px] text-muted-foreground">
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
