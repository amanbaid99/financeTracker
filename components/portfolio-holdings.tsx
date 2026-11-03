"use client";

import { Plus, Search, X } from "lucide-react";
import { useCallback, useState } from "react";
import { InvestmentSheet } from "@/components/investment-sheet";
import { useQuickAction } from "@/components/quick-add";
import { clearParam } from "@/lib/clear-param";
import { Input, Select } from "@/components/ui/input";
import {
  editedDate,
  visibleHoldings,
  type HoldingSort,
} from "@/lib/portfolio-view";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import {
  ASSET_CLASSES,
  swatchFor,
  type PortfolioHolding,
  type AssetClass,
} from "@/lib/portfolio";
import type { Investment, Link } from "@/lib/tracker";
import { cn } from "@/lib/utils";

const pct = (n: number) => `${(n * 100).toFixed(Math.abs(n) < 0.1 ? 1 : 0)}%`;
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${formatINR(Math.abs(n))}`;
const slotOf = (key: string) =>
  ASSET_CLASSES.find((c) => c.key === key)?.slot ?? 7;

/** Every holding; tap one to edit it, or add one that isn't on a goal yet. */
export function PortfolioHoldings({
  holdings,
  investments,
  links,
  assetClass = null,
  onClearClass,
  autoAdd = false,
}: {
  assetClass?: AssetClass | null;
  onClearClass?: () => void;
  autoAdd?: boolean;
  holdings: PortfolioHolding[];
  investments: Investment[];
  links: Link[];
}) {
  const [open, setOpen] = useState<Investment | "new" | null>(
    autoAdd ? "new" : null,
  );
  const close = useCallback(() => {
    setOpen(null);
    clearParam("do");
  }, []);
  useQuickAction(
    "add",
    useCallback(() => setOpen("new"), []),
  );
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<HoldingSort>("value");
  const shown = visibleHoldings(holdings, query, assetClass, sort);
  const activeLabel = ASSET_CLASSES.find((c) => c.key === assetClass)?.label;
  const filtered = !!query.trim() || !!assetClass;
  const reset = () => {
    setQuery("");
    onClearClass?.();
  };
  const byId = new Map(investments.map((i) => [i.id, i]));

  return (
    <>
      <div className="space-y-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="holdings-h" className="font-semibold">
            Holdings
          </h2>
          <p className="text-xs text-muted-foreground" role="status">
            {filtered
              ? `${shown.length} of ${holdings.length}`
              : holdings.length}
          </p>
        </div>
        {holdings.length > 0 && (
          <>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                aria-label="Search holdings"
                placeholder="Search holdings"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-11 pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {activeLabel ? (
                <button
                  type="button"
                  onClick={onClearClass}
                  aria-label="Clear asset filter"
                  className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl bg-primary-soft px-3 text-xs font-medium text-primary"
                >
                  {activeLabel}
                  <X className="size-3.5 shrink-0" aria-hidden />
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  All asset classes
                </span>
              )}
              <Select
                aria-label="Sort holdings"
                value={sort}
                onChange={(e) => setSort(e.target.value as HoldingSort)}
                className="h-11 w-auto max-w-full text-sm"
              >
                <option value="value">Largest value</option>
                <option value="name">Name A to Z</option>
                <option value="growth">Highest growth %</option>
              </Select>
            </div>
            {sort === "growth" && (
              <p className="text-xs text-muted-foreground">
                Simple growth, where the amount invested is known. Not an annual
                return.
              </p>
            )}
          </>
        )}
      </div>
      {shown.length === 0 && holdings.length > 0 && (
        <div className="space-y-2 px-4 pb-4 text-sm">
          <p className="text-muted-foreground">
            No holdings match these filters.
          </p>
          <button
            type="button"
            onClick={reset}
            className="min-h-11 font-medium text-primary"
          >
            Clear filters
          </button>
        </div>
      )}
      <ul className="divide-y" aria-label="Holdings">
        {shown.map((h) => {
          const inv = byId.get(h.id);
          return (
            <li key={h.id}>
              <button
                type="button"
                disabled={!inv}
                onClick={() => inv && setOpen(inv)}
                aria-label={`Edit ${h.name}`}
                className="press grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-muted/60"
              >
                <span className="min-w-0">
                  <span className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        swatchFor(slotOf(h.assetClass)),
                      )}
                      aria-hidden
                    />
                    <span className="line-clamp-2 min-w-0 break-words text-sm font-medium leading-snug">
                      {h.name}
                    </span>
                  </span>
                  <span className="ml-4 mt-1 block text-xs text-muted-foreground">
                    {h.kindLabel} · {pct(h.share)}
                  </span>
                  {h.monthlySip > 0 && (
                    <span className="tabular ml-4 mt-0.5 block text-xs text-muted-foreground">
                      {formatINR(h.monthlySip)}/mo
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <span className="tabular block text-sm">
                    {formatINR(h.value)}
                  </span>
                  {h.gain !== null && h.gainPct !== null && (
                    <span
                      className={cn(
                        "tabular block text-xs",
                        h.gain >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      {signed(h.gain)} ({h.gain >= 0 ? "+" : "−"}
                      {pct(Math.abs(h.gainPct))})
                    </span>
                  )}
                </span>
                {editedDate(inv?.updatedAt) && (
                  <span className="col-span-2 ml-4 text-[11px] text-muted-foreground">
                    Last edited {editedDate(inv?.updatedAt)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="px-5 pb-4 pt-2 sm:px-6">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setOpen("new")}
        >
          <Plus /> Add an investment or saving
        </Button>
      </div>
      {open && (
        <InvestmentSheet
          goalId={null}
          linkedIds={[]}
          investment={open === "new" ? null : open}
          percent={null}
          investments={investments}
          links={links}
          onClose={close}
        />
      )}
    </>
  );
}
