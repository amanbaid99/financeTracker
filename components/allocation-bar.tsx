"use client";

import { formatINR, formatINRCompact } from "@/lib/format";
import { swatchFor, type AssetClass, type Portfolio } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

/** Whole percentages, so the numbers line up and add up at a glance. */
const pct = (n: number) =>
  n > 0 && n < 0.005 ? "<1%" : `${Math.round(n * 100)}%`;

export interface AllocationItem {
  key: string;
  label: string;
  value: number;
  share: number;
  /** Colour slot from `swatchFor`. */
  slot: number;
}

/**
 * One bar and compact chips (the chips carry the numbers, so there's no
 * sentence repeating them). Tapping a segment or chip filters
 * the holdings below when `onSelect` is given.
 */
export function CompactAllocation({
  items: given,
  label,
  active = null,
  onSelect,
}: {
  items: AllocationItem[];
  label: string;
  active?: string | null;
  onSelect?: (key: string | null) => void;
}) {
  const select = (key: string) => onSelect?.(active === key ? null : key);
  // Largest first, in the bar and the chips alike.
  const items = [...given].sort((a, b) => b.share - a.share);
  const picked = items.find((i) => i.key === active);
  return (
    <div className="space-y-2 pt-3">
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
        role="group"
        aria-label={label}
      >
        {items.map((c) => {
          const bar = (
            <span
              className={cn(
                "block h-full w-full transition-opacity",
                swatchFor(c.slot),
                active && active !== c.key && "opacity-35",
              )}
            />
          );
          const style = { flexGrow: Math.max(c.share, 0.005), flexBasis: 0 };
          return onSelect ? (
            <button
              key={c.key}
              type="button"
              aria-label={`${c.label}: ${formatINRCompact(c.value)}, ${pct(c.share)}`}
              aria-pressed={active === c.key}
              onClick={() => select(c.key)}
              style={style}
              className="flex h-full min-w-1"
            >
              {bar}
            </button>
          ) : (
            <span
              key={c.key}
              style={style}
              className="flex h-full min-w-1"
              aria-hidden
            >
              {bar}
            </span>
          );
        })}
      </div>
      <ul
        className="flex flex-wrap gap-1.5 pt-1"
        aria-label={`${label} legend`}
      >
        {items.map((c) => {
          const chip = (
            <>
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  swatchFor(c.slot),
                )}
                aria-hidden
              />
              {c.label}
              <span className="tabular font-semibold">{pct(c.share)}</span>
            </>
          );
          const base =
            "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs";
          return (
            <li key={c.key}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => select(c.key)}
                  aria-pressed={active === c.key}
                  aria-label={`Filter ${c.label}, ${formatINR(c.value)}`}
                  className={cn(
                    base,
                    active === c.key
                      ? "border-primary/40 bg-primary-soft text-primary"
                      : "border-border/70 bg-card hover:bg-muted/60",
                  )}
                >
                  {chip}
                </button>
              ) : (
                <span className={cn(base, "border-border/70 bg-card")}>
                  {chip}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {picked && (
        <p className="text-xs text-muted-foreground">
          {picked.label}: {formatINR(picked.value)}. Showing these holdings
          below. Tap again to show all.
        </p>
      )}
    </div>
  );
}

/** Asset classes; doubles as the holdings filter. */
export function AllocationBar({
  classes,
  active,
  onSelect,
}: {
  classes: Portfolio["classes"];
  active: AssetClass | null;
  onSelect: (key: AssetClass | null) => void;
}) {
  return (
    <CompactAllocation
      label="Where your money is"
      items={classes.map((c) => ({
        key: c.key,
        label:
          c.key === "retirement"
            ? "Retirement"
            : c.key === "debt"
              ? "Debt"
              : c.label,
        value: c.value,
        share: c.share,
        slot: c.slot,
      }))}
      active={active}
      onSelect={(k) => onSelect(k as AssetClass | null)}
    />
  );
}
