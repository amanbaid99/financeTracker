"use client";

import { useState } from "react";
import { AllocationBar } from "@/components/allocation-bar";
import { PortfolioHoldings } from "@/components/portfolio-holdings";
import { formatINR, formatINRCompact } from "@/lib/format";
import { editedDate } from "@/lib/portfolio-view";
import {
  ASSET_CLASSES,
  swatchFor,
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
          <h2 className="text-sm font-semibold">Where your money is</h2>
          <AllocationBar
            classes={p.classes}
            active={assetClass}
            onSelect={setAssetClass}
          />
        </div>
        <details className="mt-2 border-t">
          <summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium text-primary">
            By kind
          </summary>
          <ul className="space-y-2 pb-2 text-xs">
            {p.kinds.map((k) => (
              <li
                key={k.label}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      swatchFor(
                        ASSET_CLASSES.find((c) => c.key === k.assetClass)
                          ?.slot ?? 7,
                      ),
                    )}
                    aria-hidden
                  />
                  {k.label}
                </span>
                <span className="tabular shrink-0">
                  {formatINRCompact(k.value)} · {Math.round(k.share * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </details>
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
