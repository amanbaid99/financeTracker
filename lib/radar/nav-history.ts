import { z } from "zod";
import type { EtfNav } from "./etf-data";

export const NAV_HISTORY_ORIGIN = "https://api.mfapi.in";
export interface NavHistory {
  isin: string;
  schemeCode: string;
  source: string;
  fetchedAt: string;
  /** The mirror supplies valuation dates, not historical publication times or adjustment assurances. */
  publicationTimesVerified: false;
  adjustmentsVerified: false;
  officialCheck: { source: string; date: string; nav: number };
  points: { date: string; nav: number }[];
}
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};
export function historyWindow(end: string) {
  if (!validDate(end)) throw new Error("A valid completed session is needed for NAV history.");
  return {
    start: new Date(Date.parse(`${end}T00:00:00Z`) - 550 * 86400000).toISOString().slice(0, 10),
    end,
  };
}
const schema = z.object({
  status: z.literal("SUCCESS"),
  meta: z.object({
    scheme_code: z.number().int().positive(),
    isin_growth: z.string().nullable().optional(),
    isin_div_reinvestment: z.string().nullable().optional(),
  }),
  data: z.array(z.object({ date: z.string(), nav: z.string() })).min(1).max(10000),
});
const validateAnchor = (anchor: EtfNav, expectedSession: string) => {
  if (!/^IN[A-Z0-9]{10}$/.test(anchor.isin) || !/^\d{1,8}$/.test(anchor.schemeCode) ||
    !validDate(expectedSession) || anchor.date !== expectedSession ||
    !Number.isFinite(anchor.nav) || anchor.nav <= 0)
    throw new Error("NAV history needs an official same-session NAV and scheme identity first.");
};
/** Exact code and ISIN, then same-date NAV reconciliation. No name lookup or cross-fund fallback. */
export function parseNavHistory(body: unknown, anchor: EtfNav, expectedSession: string, fetchedAt: string): NavHistory {
  validateAnchor(anchor, expectedSession);
  if (!z.iso.datetime({ offset: true }).safeParse(fetchedAt).success ||
    Date.parse(fetchedAt) < Date.parse(`${expectedSession}T15:30:00+05:30`))
    throw new Error("A valid history retrieval time after the session close is needed.");
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error("The NAV history source returned an unsupported response.");
  const { meta, data } = parsed.data;
  if (String(meta.scheme_code) !== anchor.schemeCode ||
    ![meta.isin_growth, meta.isin_div_reinvestment].includes(anchor.isin))
    throw new Error("NAV history did not match the official scheme code and ISIN.");
  const window = historyWindow(expectedSession);
  const byDate = new Map<string, number>();
  for (const row of data) {
    const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(row.date);
    const date = match ? `${match[3]}-${match[2]}-${match[1]}` : "";
    const nav = /^\d+(?:\.\d+)?$/.test(row.nav) ? Number(row.nav) : NaN;
    if (!validDate(date) || !Number.isFinite(nav) || nav <= 0)
      throw new Error("NAV history contained an invalid date or value.");
    if (date < window.start || date > window.end) continue;
    if (byDate.has(date)) throw new Error("NAV history contained duplicate session dates.");
    byDate.set(date, nav);
  }
  const latest = byDate.get(anchor.date);
  // AMFI and the mirror may print different trailing decimal places; absolute tolerance is one 4dp unit.
  if (latest === undefined || Math.abs(latest - anchor.nav) > Math.min(0.000100001, anchor.nav * 0.000001))
    throw new Error("Historical NAV could not be reconciled with the official latest NAV.");
  return {
    isin: anchor.isin, schemeCode: anchor.schemeCode,
    source: `${NAV_HISTORY_ORIGIN}/mf/${anchor.schemeCode}`,
    fetchedAt, publicationTimesVerified: false, adjustmentsVerified: false,
    officialCheck: { source: anchor.source, date: anchor.date, nav: anchor.nav },
    points: [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, nav]) => ({ date, nav })),
  };
}

export async function fetchNavHistory(anchor: EtfNav, expectedSession: string, fetchedAt: string, request: typeof fetch = fetch) {
  validateAnchor(anchor, expectedSession);
  const window = historyWindow(expectedSession);
  const url = new URL(`/mf/${anchor.schemeCode}`, NAV_HISTORY_ORIGIN);
  url.searchParams.set("startDate", window.start);
  url.searchParams.set("endDate", window.end);
  let response: Response;
  try {
    response = await request(url, {
      method: "GET", headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000), cache: "no-store", redirect: "error",
    });
  } catch {
    throw new Error("The NAV history source could not be reached. Try again later.");
  }
  if (!response.ok) throw new Error("NAV history is unavailable. Try again later.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The NAV history source returned an empty response.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 1_000_000) {
      await reader.cancel();
      throw new Error("The NAV history response was larger than expected.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error("The NAV history source returned an unreadable response."); }
  return parseNavHistory(body, anchor, expectedSession, fetchedAt);
}
