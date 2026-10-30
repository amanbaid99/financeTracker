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
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Allocation legend">
        {classes.map(c => <li key={c.key}>
          <button type="button" onClick={() => setActive(active === c.key ? null : c.key)} aria-pressed={active === c.key} className="inline-flex min-h-9 items-center gap-1.5 text-left">
            <span className={cn("size-2 shrink-0 rounded-sm", swatchFor(c.slot))} aria-hidden />
            <span>{c.label} <span className="tabular text-muted-foreground">{pct(c.share)}</span></span>
          </button>
        </li>)}
      </ul>
      {shown && <p className="text-sm text-muted-foreground" aria-live="polite"><span className="font-medium text-foreground">{shown.label}</span> · {formatINR(shown.value)} · {pct(shown.share)}</p>}
    </div>
  );
}
