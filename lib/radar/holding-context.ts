export interface HoldingContext {
  matched: boolean;
  recordedValue: number | null;
  trackedSharePct: number | null;
}
/** Only exact security identifiers establish a holding. Never infer a target allocation. */
export function holdingContext(isin: string | null, holdings: readonly { isin: string | null; current_value: number }[]): HoldingContext {
  const empty: HoldingContext = { matched: false, recordedValue: null, trackedSharePct: null };
  if (!isin || !/^IN[A-Z0-9]{10}$/.test(isin)) return empty;
  const matched = holdings.filter((h) => h.isin === isin);
  const valid = (n: number) => Number.isSafeInteger(n) && n >= 0;
  const owned = matched.some((h) => valid(h.current_value) && h.current_value > 0);
  if (!owned) return empty;
  if (matched.some((h) => !valid(h.current_value))) return { ...empty, matched: true };
  const recordedValue = matched.reduce((s, h) => s + h.current_value, 0);
  if (!valid(recordedValue)) return { ...empty, matched: true };
  if (holdings.some((h) => !valid(h.current_value))) return { matched: true, recordedValue, trackedSharePct: null };
  const total = holdings.reduce((s, h) => s + h.current_value, 0);
  return { matched: true, recordedValue, trackedSharePct: valid(total) && total > 0 ? recordedValue / total * 100 : null };
}
