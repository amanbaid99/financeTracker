import type { AssetClass, PortfolioHolding } from "./portfolio";

export type HoldingSort = "value" | "name" | "growth";

/** Search and class filters intersect; unknown growth sorts after known returns. */
export function visibleHoldings(
  holdings: PortfolioHolding[],
  query: string,
  assetClass: AssetClass | null,
  sort: HoldingSort,
): PortfolioHolding[] {
  const words = query
    .trim()
    .toLocaleLowerCase("en-IN")
    .split(/\s+/)
    .filter(Boolean);
  return holdings
    .filter(
      (h) =>
        (!assetClass || h.assetClass === assetClass) &&
        words.every((word) =>
          `${h.name} ${h.kindLabel}`.toLocaleLowerCase("en-IN").includes(word),
        ),
    )
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "en-IN");
      if (sort === "growth") {
        if (a.gainPct === null && b.gainPct !== null) return 1;
        if (b.gainPct === null && a.gainPct !== null) return -1;
        if (a.gainPct !== null && b.gainPct !== null && a.gainPct !== b.gainPct)
          return b.gainPct - a.gainPct;
      }
      return b.value - a.value || a.name.localeCompare(b.name, "en-IN");
    });
}

/** A record edit time, not a price date or CAS statement date. */
export function editedDate(value: string | null | undefined): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
  }).format(new Date(value));
}
