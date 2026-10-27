"use client";

import { ChevronRight, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { InvestmentSheet } from "@/components/investment-sheet";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import {
  ASSET_CLASSES,
  swatchFor,
  type PortfolioHolding,
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
}: {
  holdings: PortfolioHolding[];
  investments: Investment[];
  links: Link[];
}) {
  const [open, setOpen] = useState<Investment | "new" | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const byId = new Map(investments.map((i) => [i.id, i]));

  return (
    <>
      <ul className="divide-y" aria-label="Holdings">
        {holdings.map((h) => {
          const inv = byId.get(h.id);
          return (
            <li key={h.id}>
              <button
                type="button"
                disabled={!inv}
                onClick={() => inv && setOpen(inv)}
                aria-label={`Edit ${h.name}`}
                className="press flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-muted sm:px-6"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2.5 shrink-0 rounded-sm",
                    swatchFor(slotOf(h.assetClass)),
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {h.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {h.kindLabel} · {pct(h.share)}
                    {h.monthlySip > 0 ? ` · ${formatINR(h.monthlySip)}/mo` : ""}
                  </span>
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
                <ChevronRight
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
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
