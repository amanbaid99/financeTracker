import type { NavHistory } from "./nav-history";
import type { GoldSources } from "./gold-model";
import { z } from "zod";

export const NAV_SOURCE = "https://portal.amfiindia.com/spages/NAVAll.txt";
export interface EtfNav {
  isin: string;
  schemeCode: string;
  name: string;
  date: string;
  nav: number;
  goldEtf: boolean;
  source: string;
}
export interface MarketDepth {
  bid: number;
  ask: number;
  spreadPct: number;
  marketTime: string | null;
  /** Only true once the provider contract explicitly identifies the book timestamp. */
  timestampVerified?: boolean;
  fetchedAt: string;
}
export type DepthFailure = "no-active-book" | "invalid-book" | "access-denied" | "rate-limited" | "source-unavailable";
export class DepthUnavailableError extends Error {
  constructor(public reason: "no-active-book" | "invalid-book", message: string) { super(message); }
}
export interface DepthStatus {
  state: "available-untimestamped" | "available-timestamped" | "unavailable";
  reason?: DepthFailure;
  message: string;
}
export interface MarketEvidence {
  depthStatus?: DepthStatus;
  depth: MarketDepth | null;
  errors: string[];
}
export interface EtfEvidence extends MarketEvidence {
  navHistory?: NavHistory;
  /** Only populated by a verified server-side source adapter, never manual rule settings. */
  goldSources?: GoldSources;
  nav: EtfNav | null;
}
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export function amfiDate(value: string): string | null {
  const match = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month =
    months.findIndex((m) => m.toLowerCase() === match[2].toLowerCase()) + 1;
  const iso = `${match[3]}-${String(month).padStart(2, "0")}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return month > 0 &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}
/** Supports both AMFI's current eight-column and legacy six-column files. ISIN only, no name guessing. */
export function parseAmfiNav(text: string, isin: string): EtfNav | null {
  if (!/^IN[A-Z0-9]{10}$/.test(isin)) return null;
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const header = lines
    .find((l) => l.startsWith("Scheme Code;"))
    ?.split(";")
    .map((s) => s.trim());
  if (!header) throw new Error("AMFI returned an unsupported NAV format.");
  const navIndex = header.indexOf("Net Asset Value"),
    dateIndex = header.indexOf("Date"),
    nameIndex = header.indexOf("Scheme Name");
  if (navIndex < 0 || dateIndex < 0 || nameIndex < 0)
    throw new Error("AMFI's NAV columns could not be identified.");
  let group = "";
  const matches: EtfNav[] = [];
  for (const line of lines) {
    if (
      line.startsWith("Open Ended Schemes") ||
      line.startsWith("Close Ended Schemes") ||
      line.startsWith("Interval Fund Schemes")
    )
      group = line;
    if (!line.includes(";")) continue;
    const fields = line.split(";").map((s) => s.trim());
    if (fields[1] !== isin && fields[2] !== isin) continue;
    const nav = Number(fields[navIndex]),
      date = amfiDate(fields[dateIndex] ?? "");
    if (
      !/^\d+$/.test(fields[0]) ||
      !fields[nameIndex] ||
      !date ||
      !Number.isFinite(nav) ||
      nav <= 0
    )
      throw new Error("AMFI returned an invalid NAV for this ISIN.");
    matches.push({
      isin,
      schemeCode: fields[0],
      name: fields[nameIndex],
      date,
      nav,
      goldEtf: /Other Scheme\s*-\s*Gold ETF\)/i.test(group),
      source: NAV_SOURCE,
    });
  }
  if (matches.length > 1)
    throw new Error(
      "AMFI returned more than one NAV for this ISIN. The match needs review.",
    );
  return matches[0] ?? null;
}
export async function fetchAmfiNav(
  isin: string,
  request: typeof fetch = fetch,
) {
  return parseAmfiNav(await fetchAmfiText(request), isin);
}

/** AMFI's whole daily NAV file, size-capped. Parse it once for many ISINs. */
export async function fetchAmfiText(request: typeof fetch = fetch) {
  let response: Response;
  try {
    response = await request(NAV_SOURCE, {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    throw new Error("AMFI NAV could not be reached. Try again later.");
  }
  if (!response.ok)
    throw new Error("AMFI NAV is unavailable. Try again later.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("AMFI returned an empty file.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 8_000_000) {
      await reader.cancel();
      throw new Error("AMFI returned an unexpectedly large NAV file.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}

const number = z.preprocess(
  (v) => (typeof v === "string" ? Number(v.replaceAll(",", "")) : v),
  z.number().finite().nonnegative(),
);
export function parseDepth(
  body: unknown,
  code: string,
  fetchedAt: string,
): MarketDepth {
  const schema = z.object({
    status: z.literal("success"),
    data: z.record(
      z.string(),
      z.object({
        market_depth: z.object({
          depth: z
            .array(
              z.object({
                buy: z.object({ price: number, quantity: number }),
                sell: z.object({ price: number, quantity: number }),
              }),
            ),
        }),
        quote_time: z.union([z.string(), z.number()]).optional(),
      }),
    ),
  });
  const parsed = schema.safeParse(body);
  const row = parsed.success ? parsed.data.data[code] : null;
  if (!row)
    throw new DepthUnavailableError(
      "invalid-book", "A valid bid and ask were not returned for this instrument.",
    );
  const bids = row.market_depth.depth
    .filter((d) => d.buy.quantity > 0 && d.buy.price > 0)
    .map((d) => d.buy.price);
  const asks = row.market_depth.depth
    .filter((d) => d.sell.quantity > 0 && d.sell.price > 0)
    .map((d) => d.sell.price);
  if (!bids.length || !asks.length)
    throw new DepthUnavailableError("no-active-book", "An active bid and ask are needed to calculate spread.");
  const bid = Math.max(...bids),
    ask = Math.min(...asks);
  if (ask < bid)
    throw new DepthUnavailableError(
      "invalid-book", "The returned bid and ask are crossed. Spread is unavailable.",
    );
  let marketTime: string | null = null;
  // The documented REST depth quote has no market timestamp. Never use HTTP Date or fetch time as a market timestamp.
  const raw = row.quote_time;
  if (
    typeof raw === "string" &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw) &&
    Number.isFinite(Date.parse(raw))
  )
    marketTime = new Date(raw).toISOString();
  return {
    bid,
    ask,
    spreadPct: ((ask - bid) / ((ask + bid) / 2)) * 100,
    marketTime,
    timestampVerified: false,
    fetchedAt,
  };
}
