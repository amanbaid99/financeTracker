import {
  ChevronRight,
  CircleAlert,
  CreditCard,
  PieChart,
  Sparkles,
  Target,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { loadCards, loadGoals } from "@/lib/data";
import { formatINR, formatINRCompact } from "@/lib/format";
import {
  cardsLine,
  goalsLine,
  greeting,
  needsYou,
  type Urgency,
} from "@/lib/home";
import { buildPortfolio } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

const DOT: Record<Urgency, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  nudge: "bg-primary",
};

export default async function HomePage() {
  const [{ goals, investments, today }, { cards }] = await Promise.all([
    loadGoals(),
    loadCards(),
  ]);
  const p = buildPortfolio(investments);
  const items = needsYou(goals, cards, today);
  const shown = items.slice(0, 4);
  const growth = p.growth && p.growth.invested > 0 ? p.growth : null;

  const rows = [
    { href: "/goals", icon: Target, label: "Goals", line: goalsLine(goals) },
    {
      href: "/portfolio",
      icon: PieChart,
      label: "Portfolio",
      line: p.total
        ? `${formatINRCompact(p.total)}${growth ? ` · ${growth.gain >= 0 ? "+" : "−"}${formatINRCompact(Math.abs(growth.gain))} grown` : ""}`
        : "Import a statement to see it",
    },
    {
      href: "/cards",
      icon: CreditCard,
      label: "Cards",
      line: cardsLine(cards, today),
    },
  ];

  return (
    <main className="space-y-6">
      <section className="space-y-1 pt-2">
        <p className="text-sm text-muted-foreground">{greeting()}</p>
        <h1 className="text-4xl font-semibold tracking-tight tabular">
          {formatINR(p.total)}
        </h1>
        <p className="text-sm text-muted-foreground">
          saved and invested
          {p.monthlySips > 0
            ? ` · ${formatINR(p.monthlySips)} a month going in`
            : ""}
        </p>
      </section>

      <section aria-labelledby="needs-you" className="space-y-2">
        <h2 id="needs-you" className="text-sm font-semibold">
          Needs you
        </h2>
        {shown.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl bg-success-soft p-4 text-sm text-success">
            <Sparkles className="size-5 shrink-0" aria-hidden />
            All good. Nothing needs you right now.
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {shown.map((n) => (
              <li key={n.key}>
                <Link
                  href={n.href}
                  transitionTypes={["tab"]}
                  className="press flex items-center gap-3 p-4 hover:bg-muted"
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      DOT[n.urgency],
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {n.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {n.detail}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {items.length > shown.length && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CircleAlert className="size-3.5" aria-hidden />
            {items.length - shown.length} more in Goals and Cards
          </p>
        )}
      </section>

      <section aria-label="Your sections">
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {rows.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                transitionTypes={["tab"]}
                className="press flex items-center gap-3 p-4 hover:bg-muted"
              >
                <span
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
                  aria-hidden
                >
                  <r.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{r.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.line}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
