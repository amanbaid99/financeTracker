"use client";

import { formatINR, formatINRCompact } from "@/lib/format";
import { swatchFor, type AssetClass, type Portfolio } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;

export interface AllocationItem {
  key: string;
  label: string;
  value: number;
  share: number;
  /** Colour slot from `swatchFor`. */
  slot: number;
}

/** "Equity" to "equity", but "EPF / VPF" stays as it is. */
const lower = (s: string) =>
  /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;

/** "Your money is 45% in retirement, 35% in debt and 16% in equity." */
function summary(items: AllocationItem[]): string {
  const sorted = [...items].sort((a, b) => b.share - a.share);
  // The top three by name; the rest as one share, so it stays one line or two.
  const top = sorted.length > 4 ? sorted.slice(0, 3) : sorted;
  const rest = sorted.slice(top.length).reduce((t, i) => t + i.share, 0);
  const parts = top.map((i) => `${pct(i.share)} in ${lower(i.label)}`);
  if (rest > 0) parts.push(`${pct(rest)} elsewhere`);
  if (parts.length <= 1) return `Your money is ${parts[0] ?? "nowhere yet"}.`;
  return `Your money is ${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}.`;
}

/**
 * A sentence, one bar and compact chips. Tapping a segment or chip filters
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
    <div className="space-y-2 pt-1">
      <p className="text-sm text-muted-foreground">
        {picked
          ? `${picked.label}: ${formatINR(picked.value)}, ${pct(picked.share)} of the total.`
          : summary(items)}
      </p>
      <div
        className="flex min-h-8 w-full items-center gap-0.5"
        role="group"
        aria-label={label}
      >
        {items.map((c, i) => {
          const bar = (
            <span
              className={cn(
                "block h-3 w-full transition-opacity",
                swatchFor(c.slot),
                i === 0 && "rounded-l-full",
                i === items.length - 1 && "rounded-r-full",
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
              className="flex h-8 min-w-[3px] items-center"
            >
              {bar}
            </button>
          ) : (
            <span
              key={c.key}
              style={style}
              className="flex h-8 min-w-[3px] items-center"
              aria-hidden
            >
              {bar}
            </span>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label={`${label} legend`}>
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
            "inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs";
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
                      ? "bg-primary-soft text-primary"
                      : "bg-muted/60 hover:bg-muted",
                  )}
                >
                  {chip}
                </button>
              ) : (
                <span className={cn(base, "bg-muted/60")}>{chip}</span>
              )}
            </li>
          );
        })}
      </ul>
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
