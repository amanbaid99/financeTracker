// Values from market prices: units held × the latest NAV from AMFI, matched
// by ISIN. Pure: the caller fetches the NAV file. Nothing is saved here.

import { parseAmfiNav } from "./radar/etf-data";

export interface PriceHolding {
  id: string;
  name: string;
  kind: string;
  value: number;
  units: number | null;
  isin: string | null;
}

export interface PriceUpdate {
  id: string;
  name: string;
  units: number;
  price: number;
  /** The NAV's own date (yyyy-mm-dd). */
  date: string;
  oldValue: number;
  newValue: number;
}

export interface PriceSkip {
  id: string;
  name: string;
  reason: string;
}

const MARKET = new Set(["mutual_fund", "stock", "gold"]);

export function priceUpdates(
  holdings: PriceHolding[],
  navFile: string,
): { updates: PriceUpdate[]; skipped: PriceSkip[] } {
  const updates: PriceUpdate[] = [];
  const skipped: PriceSkip[] = [];
  for (const h of holdings) {
    if (!MARKET.has(h.kind)) continue;
    const name = h.name ?? "Holding";
    if (!h.isin) {
      skipped.push({ id: h.id, name, reason: "Add its ISIN" });
      continue;
    }
    if (!h.units || h.units <= 0) {
      skipped.push({ id: h.id, name, reason: "Add units held" });
      continue;
    }
    let nav;
    try {
      nav = parseAmfiNav(navFile, h.isin);
    } catch {
      skipped.push({ id: h.id, name, reason: "Price needs a check" });
      continue;
    }
    if (!nav) {
      skipped.push({
        id: h.id,
        name,
        reason:
          h.kind === "stock"
            ? "Stock prices aren't supported yet"
            : "No price found for this ISIN",
      });
      continue;
    }
    updates.push({
      id: h.id,
      name,
      units: h.units,
      price: nav.nav,
      date: nav.date,
      oldValue: h.value,
      newValue: Math.round(h.units * nav.nav),
    });
  }
  return { updates, skipped };
}
