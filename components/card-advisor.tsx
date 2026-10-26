"use client";

import { Lightbulb } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  adviseCards,
  SPEND_CATEGORIES,
  type PlanStatus,
  type SpendCategory,
} from "@/lib/card-advisor";
import type { Card } from "@/lib/cards";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS: Record<PlanStatus, { short: string; tone: string }> = {
  chase: { short: "Within reach", tone: "text-success" },
  stretch: { short: "Needs extra spend", tone: "text-warning" },
  unlikely: { short: "Out of reach", tone: "text-muted-foreground" },
};

/** Which card to use next, from milestones, deadlines and usual monthly spend. */
export function CardAdvisor({
  cards,
  today,
}: {
  cards: Card[];
  today: string;
}) {
  const [category, setCategory] = useState<SpendCategory | null>(null);
  const [showAll, setShowAll] = useState(false);
  const a = adviseCards(cards, today, category);
  if (!a.plan.length && !cards.some((c) => c.bestFor.length)) return null;

  return (
    <section
      aria-label="Which card to use"
      className="space-y-3 rounded-2xl border bg-card p-4"
    >
      <div className="flex items-center gap-2">
        <Lightbulb className="size-4 text-primary" aria-hidden />
        <h2 className="font-semibold">Which card to use</h2>
      </div>

      <div
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
        role="group"
        aria-label="What are you paying for?"
      >
        {(
          [null, ...Object.keys(SPEND_CATEGORIES)] as (SpendCategory | null)[]
        ).map((c) => (
          <button
            key={c ?? "any"}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs",
              category === c
                ? "border-primary bg-primary-soft text-primary"
                : "text-muted-foreground",
            )}
          >
            {c ? SPEND_CATEGORIES[c] : "Any spend"}
          </button>
        ))}
      </div>

      {a.pick ? (
        <div className="rounded-xl bg-primary-soft p-3">
          <p className="text-sm">
            Use <b>{a.pick.cardLabel}</b>
          </p>
          <p className="text-sm text-muted-foreground">{a.pick.reason}</p>
          {category &&
            a.forCategory.length > 0 &&
            a.forCategory[0].cardId !== a.pick.cardId && (
              <p className="mt-1 text-xs text-muted-foreground">
                {a.forCategory[0].cardLabel} suits{" "}
                {SPEND_CATEGORIES[category].toLowerCase()} better, but no
                milestone is riding on it.
              </p>
            )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {a.capacity === null
            ? "Log a few monthly bills so I can tell which milestones you can reach."
            : "No milestone is within reach right now. Use whichever card earns most on this spend."}
        </p>
      )}

      {a.plan.length > 0 && (
        <ul className="divide-y text-sm" aria-label="Milestone plan">
          {a.plan
            .filter(
              (p) => showAll || a.capacity === null || p.status !== "unlikely",
            )
            .map((p) => (
              <li key={p.milestone.id} className="space-y-0.5 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 font-medium">
                    {p.cardLabel}: {p.milestone.reward || p.milestone.name}
                  </p>
                  {a.capacity !== null && (
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium",
                        STATUS[p.status].tone,
                      )}
                    >
                      {STATUS[p.status].short}
                    </span>
                  )}
                </div>
                <p className="tabular text-xs text-muted-foreground">
                  {formatINR(p.milestone.remaining)} more by{" "}
                  {formatDate(p.milestone.end)}
                  {p.perMonth > 0
                    ? ` · about ${formatINR(p.perMonth)} a month`
                    : ""}
                </p>
              </li>
            ))}
        </ul>
      )}
      {a.capacity !== null && a.plan.some((p) => p.status === "unlikely") && (
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? "Hide out of reach"
            : `Show ${a.plan.filter((p) => p.status === "unlikely").length} out of reach`}
        </Button>
      )}

      {a.capacity !== null && (
        <p className="text-xs text-muted-foreground">
          Based on your usual {formatINR(a.capacity)} a month across cards, from
          your logged bills.
          {a.spare && a.plan.some((p) => p.status === "chase")
            ? ` About ${formatINR(a.spare)} a month is free after these milestones.`
            : ""}
        </p>
      )}
    </section>
  );
}
