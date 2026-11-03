"use client";

import { formatINRCompact } from "@/lib/format";
import { swatchFor, type AssetClass, type Portfolio } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;

/** Allocation doubles as a filter, with amounts visible without hovering. */
export function AllocationBar({
  classes,
  active,
  onSelect,
}: {
  classes: Portfolio["classes"];
  active: AssetClass | null;
  onSelect: (key: AssetClass | null) => void;
}) {
  const select = (key: AssetClass) => onSelect(active === key ? null : key);
  return (
    <div className="space-y-1">
      <div
        className="flex min-h-11 w-full items-center gap-0.5"
        role="group"
        aria-label="Where your money is"
      >
        {classes.map((c, i) => (
          <button
            key={c.key}
            type="button"
            aria-label={`${c.label}: ${formatINRCompact(c.value)}, ${pct(c.share)}`}
            aria-pressed={active === c.key}
            onClick={() => select(c.key)}
            style={{ flexGrow: Math.max(c.share, 0.005), flexBasis: 0 }}
            className="flex h-11 min-w-[3px] items-center"
          >
            <span
              className={cn(
                "block h-3 w-full transition-opacity",
                swatchFor(c.slot),
                i === 0 && "rounded-l-full",
                i === classes.length - 1 && "rounded-r-full",
                active && active !== c.key && "opacity-35",
              )}
            />
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4" aria-label="Allocation legend">
        {classes.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              onClick={() => select(c.key)}
              aria-pressed={active === c.key}
              aria-label={`Filter ${c.label}`}
              className={cn(
                "flex min-h-11 w-full flex-col justify-center rounded-lg px-1 text-left text-xs",
                active === c.key
                  ? "bg-primary-soft text-primary"
                  : "hover:bg-muted/60",
              )}
            >
              <span className="flex w-full items-center gap-1.5">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    swatchFor(c.slot),
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  {c.key === "retirement"
                    ? "Retirement"
                    : c.key === "debt"
                      ? "Debt"
                      : c.label}
                </span>
                <span className="tabular shrink-0 text-muted-foreground">
                  {pct(c.share)}
                </span>
              </span>
              <span className="tabular ml-3.5 mt-0.5 font-medium">
                {formatINRCompact(c.value)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
