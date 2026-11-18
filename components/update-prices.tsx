"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatINR } from "@/lib/format";
import { applyPrices, checkPrices } from "@/lib/price-actions";
import type { PriceSkip, PriceUpdate } from "@/lib/prices";
import { cn } from "@/lib/utils";

/**
 * Update prices: fetch the latest NAV for holdings with units and an ISIN,
 * show old and new values, and save only the ones the owner keeps ticked.
 */
export function UpdatePrices() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{
    updates: PriceUpdate[];
    skipped: PriceSkip[];
  } | null>(null);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const check = () =>
    start(async () => {
      setError("");
      const res = await checkPrices();
      if (!res.ok) {
        toast({ text: res.error, tone: "danger" });
        return;
      }
      setResult({ updates: res.updates, skipped: res.skipped });
      setKeep(
        new Set(
          res.updates.filter((u) => u.newValue !== u.oldValue).map((u) => u.id),
        ),
      );
    });
  const save = () =>
    start(async () => {
      const chosen = result!.updates
        .filter((u) => keep.has(u.id))
        .map((u) => ({ id: u.id, value: u.newValue }));
      const res = await applyPrices(chosen);
      if (!res.ok) return setError(res.error);
      toast({
        text: `${res.saved} ${res.saved === 1 ? "value" : "values"} updated from today's prices.`,
        tone: "success",
      });
      setResult(null);
      router.refresh();
    });
  const change = result
    ? result.updates
        .filter((u) => keep.has(u.id))
        .reduce((s, u) => s + (u.newValue - u.oldValue), 0)
    : 0;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-10"
        disabled={pending}
        onClick={check}
      >
        <RefreshCw className={cn(pending && !result && "animate-spin")} />
        Update prices
      </Button>
      {result && (
        <Sheet
          title="Update from today's prices"
          onClose={() => setResult(null)}
        >
          <div className="space-y-4">
            {result.updates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No holding has both units and an ISIN yet. Import a CAS, or tap
                a fund and add its units and ISIN.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Units held × the latest official price (NAV). Untick anything
                  you don&apos;t want to change.
                </p>
                <ul className="divide-y rounded-xl border">
                  {result.updates.map((u) => {
                    const diff = u.newValue - u.oldValue;
                    return (
                      <li key={u.id}>
                        <label className="flex items-start gap-3 p-3">
                          <Checkbox
                            checked={keep.has(u.id)}
                            onChange={(e) => {
                              const next = new Set(keep);
                              if (e.target.checked) next.add(u.id);
                              else next.delete(u.id);
                              setKeep(next);
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-sm font-medium">
                              {u.name}
                            </span>
                            <span className="tabular block text-xs text-muted-foreground">
                              {u.units.toLocaleString("en-IN", {
                                maximumFractionDigits: 3,
                              })}{" "}
                              × ₹{u.price.toLocaleString("en-IN")} ·{" "}
                              {formatDate(u.date)}
                            </span>
                          </span>
                          <span className="tabular shrink-0 text-right text-sm">
                            <span className="block font-medium">
                              {formatINR(u.newValue)}
                            </span>
                            <span
                              className={cn(
                                "block text-xs",
                                diff > 0
                                  ? "text-success"
                                  : diff < 0
                                    ? "text-danger"
                                    : "text-muted-foreground",
                              )}
                            >
                              {diff === 0
                                ? "No change"
                                : `${diff > 0 ? "+" : "−"}${formatINR(Math.abs(diff))}`}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {result.skipped.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Not updated
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {result.skipped.map((s) => (
                    <li key={s.id} className="flex justify-between gap-3">
                      <span className="min-w-0 break-words">{s.name}</span>
                      <span className="shrink-0">{s.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
            {result.updates.length > 0 && (
              <Button
                type="button"
                className="w-full"
                disabled={pending || keep.size === 0}
                onClick={save}
              >
                {pending
                  ? "Saving…"
                  : `Save ${keep.size} ${keep.size === 1 ? "value" : "values"}${
                      change
                        ? ` (${change > 0 ? "+" : "−"}${formatINR(Math.abs(change))})`
                        : ""
                    }`}
              </Button>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}
