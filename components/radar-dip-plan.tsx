"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import { refreshRadar } from "@/lib/radar/actions";
import { marketPrice, type RadarAnalysis } from "@/lib/radar/contracts";
import { dipPlan } from "@/lib/radar/dip-plan";
import { cn } from "@/lib/utils";

const KEY = "radar-dip-budget";

/**
 * One place for the daily routine: refresh every item, then see the buy
 * orders (price, quantity, amount) for a budget split across the watchlist,
 * and a take-profit price for holdings.
 */
export function RadarDipPlan({
  items,
}: {
  items: {
    id: string;
    symbol: string;
    priceBelow: number | null;
    owned: boolean;
    analysis: RadarAnalysis | null;
  }[];
}) {
  const router = useRouter();
  const [budget, setBudget] = useState<number | null>(5000);
  const [progress, setProgress] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this device
      if (saved > 0) setBudget(saved);
    } catch {
      // Storage blocked: keep the default.
    }
  }, []);
  const changeBudget = (v: number | null) => {
    setBudget(v);
    try {
      if (v && v > 0) localStorage.setItem(KEY, String(v));
    } catch {
      // Storage blocked: the budget just isn't remembered.
    }
  };
  const refreshAll = () =>
    start(async () => {
      const failed: string[] = [];
      for (const [n, item] of items.entries()) {
        setProgress(`Refreshing ${n + 1} of ${items.length}…`);
        const res = await refreshRadar(item.id);
        // "Just refreshed" is fine: that item is already up to date.
        if (!res.ok && !/just refreshed/i.test(res.error ?? ""))
          failed.push(item.symbol);
      }
      setProgress(
        failed.length
          ? `Updated, except ${failed.join(", ")}. Try those again later.`
          : "All prices are up to date.",
      );
      router.refresh();
    });
  const rows = dipPlan({ budget: budget ?? 0, items });
  const toBuy = rows.flatMap((r) =>
    r.buys.filter((b) => b.reached && b.quantity > 0).map(() => r.symbol),
  );

  return (
    <section
      aria-labelledby="dip-h"
      className="surface-card space-y-4 rounded-2xl border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="dip-h" className="font-semibold">
            Today&apos;s dip plan
          </h2>
          <p className="text-xs text-muted-foreground">
            Buy orders for each item, in two steps: a nearer dip, then a deeper
            one.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10 shrink-0"
          disabled={pending || items.length === 0}
          onClick={refreshAll}
        >
          <RefreshCw className={cn(pending && "animate-spin")} /> Refresh all
        </Button>
      </div>
      {progress && (
        <p role="status" className="text-xs text-muted-foreground">
          {progress}
        </p>
      )}
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Money for dips</span>
        <MoneyInput
          aria-label="Money for dips"
          value={budget}
          onChange={changeBudget}
          className="w-32"
        />
      </label>
      {toBuy.length > 0 && (
        <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
          Buy price reached: {[...new Set(toBuy)].join(", ")}. Check it and
          place the order in your broker app.
        </p>
      )}
      <ul className="divide-y border-t">
        {rows.map((r) => (
          <li key={r.id} className="space-y-2 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`/radar/${r.id}`}
                className="font-semibold text-primary"
              >
                {r.symbol}
              </Link>
              <span className="tabular text-sm text-muted-foreground">
                {r.close != null ? `Now ${marketPrice(r.close)}` : ""} ·{" "}
                {formatINR(r.budget)} set aside
              </span>
            </div>
            {r.buys.length > 0 && (
              <table className="w-full text-sm">
                <thead className="sr-only">
                  <tr>
                    <th>Step</th>
                    <th>Buy at or below</th>
                    <th>Quantity</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {r.buys.map((b, i) => (
                    <tr
                      key={b.price}
                      className={cn(b.reached && "text-success")}
                    >
                      <td className="py-0.5 pr-2 text-xs text-muted-foreground">
                        Buy {i + 1}
                      </td>
                      <td className="tabular py-0.5 font-medium">
                        ≤ {marketPrice(b.price)}
                      </td>
                      <td className="tabular py-0.5 text-right">
                        {b.quantity} ×
                      </td>
                      <td className="tabular py-0.5 text-right">
                        {formatINR(b.amount)}
                        {b.reached && " ✓"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {r.buys.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {r.buys.map((b) => b.basis).join(", then ")}
              </p>
            )}
            {r.sell && (
              <p
                className={cn(
                  "text-sm",
                  r.sell.reached ? "text-warning" : "text-muted-foreground",
                )}
              >
                Sell some at or above{" "}
                <span className="tabular font-medium text-foreground">
                  {marketPrice(r.sell.price)}
                </span>{" "}
                ({r.sell.basis}){r.sell.reached && ": reached"}
              </p>
            )}
            {r.note && (
              <p className="text-xs text-muted-foreground">{r.note}</p>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Prices use the last daily close. Use limit orders at these prices. Once
        a step fills, set your next buy price on that item. The app never places
        orders. Not investment advice.
      </p>
    </section>
  );
}
