import { FileUp } from "lucide-react";
import { GuideButton } from "@/components/guides";
import type { Metadata } from "next";
import Link from "next/link";
import { AllocationBar } from "@/components/allocation-bar";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadGoals } from "@/lib/data";
import { formatINR, formatINRCompact } from "@/lib/format";
import { ASSET_CLASSES, buildPortfolio, swatchFor } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Portfolio" };

const pct = (n: number) => `${(n * 100).toFixed(Math.abs(n) < 0.1 ? 1 : 0)}%`;
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${formatINR(Math.abs(n))}`;
const slotOf = (key: string) =>
  ASSET_CLASSES.find((c) => c.key === key)?.slot ?? 7;

export default async function PortfolioPage() {
  const { investments } = await loadGoals();
  const p = buildPortfolio(investments);

  if (p.holdings.length === 0) {
    return (
      <main className="space-y-5">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <GuideButton id="portfolio" />
        </div>
        <div className="space-y-3 rounded-2xl border bg-card p-6 text-center">
          <p className="font-semibold">Nothing here yet</p>
          <p className="text-sm text-muted-foreground">
            Import a CAS statement, or add investments to your goals, to see
            everything you hold in one place.
          </p>
          <Link href="/import" className={buttonVariants()}>
            <FileUp /> Import a CAS statement
          </Link>
        </div>
      </main>
    );
  }

  const equity = p.classes.find((c) => c.key === "equity")?.share ?? 0;

  return (
    <main className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <GuideButton id="portfolio" />
        </div>
        <p className="text-sm text-muted-foreground">
          Everything you hold, across all your goals.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-5 sm:pt-5">
          <p className="text-xs text-muted-foreground">Total value</p>
          <p className="tabular text-3xl font-semibold tracking-tight">
            {formatINR(p.total)}
          </p>
          <p className="text-sm text-muted-foreground">
            {p.monthlySips > 0
              ? `${formatINR(p.monthlySips)} a month going in · `
              : ""}
            {pct(equity)} in equity
          </p>
          {p.growth && (
            <div className="mt-3 space-y-1 rounded-lg bg-muted p-3 text-sm">
              <p>
                <span className="text-muted-foreground">
                  Invested {formatINR(p.growth.invested)} · now{" "}
                </span>
                {formatINR(p.growth.value)}
              </p>
              <p
                className={cn(
                  "tabular font-semibold",
                  p.growth.gain >= 0 ? "text-success" : "text-danger",
                )}
              >
                {signed(p.growth.gain)} ({p.growth.gain >= 0 ? "+" : "−"}
                {pct(Math.abs(p.growth.gainPct))}){" "}
                {p.growth.gain >= 0 ? "grown" : "down"}
              </p>
              {p.growth.known < p.growth.of && (
                <p className="text-xs text-muted-foreground">
                  On {p.growth.known} of {p.growth.of} holdings. Add the amount
                  invested to the others, or import a CAS, to include them.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where your money is</CardTitle>
        </CardHeader>
        <CardContent>
          <AllocationBar classes={p.classes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By kind</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {p.kinds.map((k) => (
              <li key={k.label} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">{k.label}</span>
                  <span className="tabular shrink-0">
                    {formatINRCompact(k.value)}{" "}
                    <span className="text-muted-foreground">
                      · {pct(k.share)}
                    </span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted" aria-hidden>
                  <div
                    className={cn(
                      "h-full rounded-full",
                      swatchFor(slotOf(k.assetClass)),
                    )}
                    style={{ width: `${Math.max(k.share * 100, 1)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <ul className="divide-y" aria-label="Holdings">
            {p.holdings.map((h) => (
              <li
                key={h.id}
                className="flex items-start gap-3 px-5 py-3 sm:px-6"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2.5 shrink-0 rounded-sm",
                    swatchFor(slotOf(h.assetClass)),
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{h.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {h.kindLabel} · {pct(h.share)}
                    {h.monthlySip > 0 ? ` · ${formatINR(h.monthlySip)}/mo` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-sm">{formatINR(h.value)}</p>
                  {h.gain !== null && h.gainPct !== null && (
                    <p
                      className={cn(
                        "tabular text-xs",
                        h.gain >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      {signed(h.gain)} ({h.gain >= 0 ? "+" : "−"}
                      {pct(Math.abs(h.gainPct))})
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
