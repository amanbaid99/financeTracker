import {
  ChevronDown,
  Compass,
  ShoppingBag,
  Receipt,
  Utensils,
  Plane,
  CreditCard,
  Smartphone,
} from "lucide-react";
import type { Card } from "@/lib/cards";
import { cardSpendGuide } from "@/lib/card-strategy";
const ICONS = {
  online: ShoppingBag,
  bills: Receipt,
  food: Utensils,
  travel: Plane,
  offline: CreditCard,
  upi: Smartphone,
};

export function CardStrategy({ cards }: { cards: Card[] }) {
  const groups = cardSpendGuide(cards);
  if (!groups.length) return null;
  return (
    <section
      aria-label="Card strategy"
      className="overflow-hidden rounded-3xl border border-primary/15 bg-card shadow-sm"
    >
      <details className="group">
        <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 bg-gradient-to-br from-primary-soft/70 to-card p-4 [&::-webkit-details-marker]:hidden">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Compass className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">
              Which card to use
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              A few simple rules to remember
            </span>
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-primary transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="divide-y divide-border/60 px-4">
          {groups.map((group) => {
            const Icon = ICONS[group.id as keyof typeof ICONS];
            return (
              <section key={group.id} aria-label={group.title} className="py-3">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Icon className="size-4 text-primary" aria-hidden />
                  {group.title}
                </h3>
                <ul className="space-y-2">
                  {group.rows.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-start justify-between gap-3"
                    >
                      <span className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
                        {row.label}
                      </span>
                      <span className="min-w-0 flex-1 text-right">
                        <span className="block break-words text-sm font-medium text-primary">
                          {row.cardName}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {row.reason}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <details className="mx-4 border-t border-border/60 pb-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 py-3 text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-3" aria-hidden />
            Limits to remember
          </summary>
          <ul className="space-y-2 pb-3 text-xs leading-relaxed text-muted-foreground">
            {groups
              .flatMap((g) => g.rows)
              .map((r) => (
                <li key={`${r.cardId}-${r.label}`}>
                  <span className="font-medium text-foreground">
                    {r.label}:{" "}
                  </span>
                  {r.limit}
                </li>
              ))}
          </ul>
        </details>
      </details>
    </section>
  );
}
