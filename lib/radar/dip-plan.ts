// "Buy the dip" order plan for the whole watchlist: split a budget across
// items, two buy steps each (a nearer dip, then a deeper one), and a
// take-profit price for anything held. Prices come from each item's saved
// buy price or its own price history (suggestedLevels). A starting point the
// owner acts on in their broker app; nothing is placed or saved.

import type { RadarAnalysis } from "./contracts";
import { suggestedLevels } from "./insight";

export interface PlanOrder {
  price: number;
  /** Whole shares or units the amount buys at that price. */
  quantity: number;
  amount: number;
  /** Where the price came from. */
  basis: string;
  /** The last close is already at or below this price. */
  reached: boolean;
}

export interface PlanRow {
  id: string;
  symbol: string;
  close: number | null;
  /** Rupees set aside for this item. */
  budget: number;
  buys: PlanOrder[];
  sell: { price: number; basis: string; reached: boolean } | null;
  note: string | null;
}

const wholeUnits = (amount: number, price: number) =>
  price > 0 ? Math.floor(amount / price) : 0;

export function dipPlan({
  budget,
  items,
}: {
  budget: number;
  items: {
    id: string;
    symbol: string;
    priceBelow: number | null;
    owned: boolean;
    analysis: RadarAnalysis | null;
  }[];
}): PlanRow[] {
  const share = items.length ? Math.floor(budget / items.length) : 0;
  return items.map((item) => {
    const a = item.analysis;
    const close = a?.close ?? null;
    const row: PlanRow = {
      id: item.id,
      symbol: item.symbol,
      close,
      budget: share,
      buys: [],
      sell: null,
      note: null,
    };
    if (close == null) {
      row.note = "Refresh to get prices.";
      return row;
    }
    const levels = suggestedLevels(a);
    // Your saved buy price first, then the app's suggestions below it.
    const prices: { price: number; basis: string }[] = [];
    if (item.priceBelow != null)
      prices.push({ price: item.priceBelow, basis: "Your buy price" });
    // Nearest dip first.
    for (const s of [...levels.buy].sort((x, y) => y.value - x.value))
      if (
        s.value < close &&
        (!prices.length || s.value < prices[prices.length - 1].price * 0.98)
      )
        prices.push({ price: s.value, basis: s.label });
    // Always two steps when possible: fall back to the one-year low.
    const low = a?.technicals.low252 ?? null;
    if (
      prices.length === 1 &&
      low != null &&
      low < prices[0].price * 0.98 &&
      low < close
    )
      prices.push({ price: Math.round(low * 100) / 100, basis: "1-year low" });
    const steps = prices.slice(0, 2);
    if (!steps.length) {
      row.note = "Needs about a year of prices to suggest dip levels.";
    } else {
      const each = steps.length === 2 ? Math.floor(share / 2) : share;
      row.buys = steps.map((s) => {
        const quantity = wholeUnits(each, s.price);
        return {
          price: s.price,
          quantity,
          amount: Math.round(quantity * s.price),
          basis: s.basis,
          reached: close <= s.price,
        };
      });
      if (row.buys.every((b) => b.quantity === 0))
        row.note = `One unit costs more than the ₹${each.toLocaleString("en-IN")} set aside per step. Raise the budget or drop an item.`;
    }
    if (item.owned && levels.sell.length) {
      // The nearest take-profit level.
      const s = [...levels.sell].sort((x, y) => x.value - y.value)[0];
      row.sell = { price: s.value, basis: s.label, reached: close >= s.value };
    }
    return row;
  });
}
