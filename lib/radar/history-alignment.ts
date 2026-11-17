import type { Candle } from "./contracts";
import type { NavHistory } from "./nav-history";

export interface HistoryAlignment {
  valid: boolean;
  matched: number;
  priceCount: number;
  navCount: number;
  priceOnly: string[];
  navOnly: string[];
  outsideSharedWindow: string[];
  sharedStart: string | null;
  sharedEnd: string | null;
}
const validDates = (dates: string[]) => dates.every((date, i) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date &&
    (!i || date > dates[i - 1]);
});

/** Compare actual dates, never row positions. Retain all unmatched records without filling gaps. */
export function alignHistory(candles: Pick<Candle, "date">[], nav: Pick<NavHistory, "points">): HistoryAlignment {
  const prices = candles.map((c) => c.date), navs = nav.points.map((p) => p.date);
  const result: HistoryAlignment = {
    valid: false, matched: 0, priceCount: prices.length, navCount: navs.length,
    priceOnly: [], navOnly: [], outsideSharedWindow: [], sharedStart: null, sharedEnd: null,
  };
  if (!prices.length || !navs.length || !validDates(prices) || !validDates(navs)) return result;
  const priceDates = new Set(prices), navDates = new Set(navs);
  result.valid = true;
  result.matched = prices.filter((date) => navDates.has(date)).length;
  result.priceOnly = prices.filter((date) => !navDates.has(date));
  result.navOnly = navs.filter((date) => !priceDates.has(date));
  const start = prices[0] > navs[0] ? prices[0] : navs[0];
  const end = prices.at(-1)! < navs.at(-1)! ? prices.at(-1)! : navs.at(-1)!;
  if (start <= end) { result.sharedStart = start; result.sharedEnd = end; }
  result.outsideSharedWindow = [...result.priceOnly, ...result.navOnly]
    .filter((date) => start > end || date < start || date > end).sort();
  return result;
}
