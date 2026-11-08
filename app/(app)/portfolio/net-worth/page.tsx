import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TrendChart } from "@/components/trend-chart";
import { Progress } from "@/components/ui/progress";
import { loadGoals, loadLoans, loadNetWorth } from "@/lib/data";
import { formatINR } from "@/lib/format";
import { loanView } from "@/lib/loans";
import { buildPortfolio, swatchFor } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Net worth" };

export default async function NetWorthPage() {
  const [{ investments, today }, loans, worth] = await Promise.all([
    loadGoals(),
    loadLoans(),
    loadNetWorth(),
  ]);
  const { history } = worth;
  const now = history[history.length - 1];
  const p = buildPortfolio(investments);
  const owed = loans
    .map((l) => ({ loan: l, view: loanView(l, today) }))
    .filter((x) => !x.view.closed && x.view.state.balance > 0)
    .sort((a, b) => b.view.state.balance - a.view.state.balance);
  const series = (f: (h: (typeof history)[number]) => number) =>
    history.map((h) => ({ day: h.day, value: f(h) }));

  return (
    <main className="space-y-4">
      <Link
        href="/portfolio"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> Portfolio
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Net worth</h1>
        <p className="text-sm text-muted-foreground">
          What you own minus what you owe on loans, and how each has moved. Tap
          a chart to see a day.
        </p>
      </div>

      <TrendChart
        title="Net worth"
        points={series((h) => h.assets - h.liabilities)}
        color="var(--primary)"
      />
      <TrendChart
        title="What you own"
        points={series((h) => h.assets)}
        color="var(--success)"
      />
      <TrendChart
        title="What you owe on loans"
        points={series((h) => h.liabilities)}
        color="var(--danger)"
        goodWhen="down"
      />

      <section
        aria-labelledby="own-h"
        className="surface-card space-y-2 rounded-2xl border border-border/70 bg-card p-4"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="own-h" className="font-semibold">
            What you own
          </h2>
          <span className="tabular text-sm font-medium">
            {formatINR(now?.assets ?? p.total)}
          </span>
        </div>
        <ul className="divide-y text-sm">
          {[...p.classes]
            .sort((a, b) => b.value - a.value)
            .map((c) => (
              <li
                key={c.key}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn("size-2 rounded-full", swatchFor(c.slot))}
                    aria-hidden
                  />
                  {c.key === "retirement"
                    ? "Retirement"
                    : c.key === "debt"
                      ? "Debt"
                      : c.label}
                </span>
                <span className="tabular">
                  {formatINR(c.value)}{" "}
                  <span className="text-xs text-muted-foreground">
                    {Math.round(c.share * 100)}%
                  </span>
                </span>
              </li>
            ))}
        </ul>
        <Link
          href="/portfolio"
          className="inline-flex min-h-10 items-center text-sm font-medium text-primary"
        >
          See holdings
        </Link>
      </section>

      <section
        aria-labelledby="owe-h"
        className="surface-card space-y-2 rounded-2xl border border-border/70 bg-card p-4"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="owe-h" className="font-semibold">
            What you owe
          </h2>
          <span className="tabular text-sm font-medium">
            {formatINR(now?.liabilities ?? 0)}
          </span>
        </div>
        {owed.length ? (
          <ul className="divide-y text-sm">
            {owed.map(({ loan, view }) => (
              <li key={loan.id} className="space-y-1.5 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 break-words font-medium">
                    {loan.name}
                  </span>
                  <span className="tabular">
                    {formatINR(view.state.balance)}
                  </span>
                </div>
                <Progress
                  value={view.progress * 100}
                  className="h-1.5"
                  tone="neutral"
                  label={`${loan.name} repaid`}
                />
                <p className="text-xs text-muted-foreground">
                  {Math.round(view.progress * 100)}% repaid
                  {view.emisLine ? ` · ${view.emisLine}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No loans to repay.</p>
        )}
        <Link
          href="/cards#loans-h"
          className="inline-flex min-h-10 items-center text-sm font-medium text-primary"
        >
          See loans
        </Link>
      </section>

      <p className="text-xs text-muted-foreground">
        A point is saved each day you add, update or remove an investment or
        loan. Card statements aren&apos;t counted.
      </p>
    </main>
  );
}
