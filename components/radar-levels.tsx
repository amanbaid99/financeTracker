"use client";

import { marketPrice } from "@/lib/radar/contracts";
import type { LevelSuggestion } from "@/lib/radar/insight";

/** Suggested levels from the price history: tap one to fill the field. */
export function LevelChips({
  options,
  onPick,
}: {
  options: LevelSuggestion[];
  onPick: (value: number) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">Suggestions, tap to use:</p>
      <ul className="space-y-1.5">
        {options.map((o) => (
          <li key={o.label}>
            <button
              type="button"
              onClick={() => onPick(o.value)}
              className="press w-full rounded-xl border border-border/70 bg-card px-3 py-2 text-left hover:border-primary/40"
            >
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{o.label}</span>
                <span className="tabular">{marketPrice(o.value)}</span>
              </span>
              <span className="block text-xs text-muted-foreground">
                {o.why}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
