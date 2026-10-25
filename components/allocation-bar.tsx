"use client";

import { useState } from "react";
import { formatINR } from "@/lib/format";
import { swatchFor, type Portfolio } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;

/** Part-to-whole bar with a legend that always shows each amount and share. */
export function AllocationBar({ classes }: { classes: Portfolio["classes"] }) {
  const [active, setActive] = useState<string | null>(null);
  const shown = classes.find((c) => c.key === active);

  return (
    <div className="space-y-3">
      <p
        className="tabular h-5 text-sm text-muted-foreground"
        aria-live="polite"
      >
        {shown ? (
          <>
            <span className="font-medium text-foreground">{shown.label}</span> ·{" "}
            {formatINR(shown.value)} · {pct(shown.share)}
          </>
        ) : (
          "Tap a part to see its amount."
        )}
      </p>
      <div
        className="flex h-4 w-full gap-[2px]"
        role="group"
        aria-label="Where your money is"
      >
        {classes.map((c, i) => (
          <button
            key={c.key}
            type="button"
            aria-label={`${c.label}: ${formatINR(c.value)}, ${pct(c.share)}`}
            onMouseEnter={() => setActive(c.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(c.key)}
            onBlur={() => setActive(null)}
            onClick={() => setActive(c.key)}
            style={{ flexGrow: Math.max(c.share, 0.005), flexBasis: 0 }}
            className={cn(
              "h-full min-w-[3px] transition-opacity",
              swatchFor(c.slot),
              i === 0 && "rounded-l",
              i === classes.length - 1 && "rounded-r",
              active && active !== c.key && "opacity-40",
            )}
          />
        ))}
      </div>
      <ul className="divide-y text-sm">
        {classes.map((c) => (
          <li
            key={c.key}
            onMouseEnter={() => setActive(c.key)}
            onMouseLeave={() => setActive(null)}
            className={cn(
              "flex items-center gap-2 py-2",
              active && active !== c.key && "opacity-60",
            )}
          >
            <span
              className={cn("size-2.5 shrink-0 rounded-sm", swatchFor(c.slot))}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{c.label}</span>
            <span className="tabular shrink-0">{formatINR(c.value)}</span>
            <span className="tabular w-12 shrink-0 text-right text-muted-foreground">
              {pct(c.share)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
