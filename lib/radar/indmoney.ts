import {
  candleSchema,
  instrumentSchema,
  type Candle,
  type RadarInstrument,
} from "./contracts";
import { todayIST } from "../dates";

export class RadarProviderError extends Error {}

/** CSV parser handles quoted commas, escaped quotes and embedded newlines. No evaluation. */
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted)
    throw new RadarProviderError("The instrument list could not be read.");
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  if (rows.length > 100000)
    throw new RadarProviderError(
      "The instrument list is larger than expected.",
    );
  return rows;
}

export function parseInstruments(text: string): RadarInstrument[] {
  const [header, ...rows] = csvRows(text.replace(/^\uFEFF/, ""));
  if (
    !header ||
    ![
      "EXCH",
      "SECURITY_ID",
      "TRADING_SYMBOL",
      "SEGMENT",
      "INSTRUMENT_NAME",
    ].every((h) => header.includes(h))
  )
    throw new RadarProviderError(
      "INDmoney returned an unsupported instrument format.",
    );
  const instruments: RadarInstrument[] = [];
  for (const row of rows) {
    const get = (key: string) => (row[header.indexOf(key)] ?? "").trim();
    if (
      get("SEGMENT") !== "E" ||
      !["NSE", "BSE"].includes(get("EXCH")) ||
      !["EQUITY", "ETF", "EQ"].includes(get("INSTRUMENT_NAME"))
    )
      continue;
    const parsed = instrumentSchema.safeParse({
      exchange: get("EXCH"),
      securityId: get("SECURITY_ID"),
      symbol: get("TRADING_SYMBOL"),
      name: get("CUSTOM_SYMBOL") || get("SYMBOL_NAME") || get("TRADING_SYMBOL"),
      isin: get("ISIN") || null,
    });
    if (parsed.success) instruments.push(parsed.data);
  }
  if (!instruments.length)
    throw new RadarProviderError(
      "No supported cash-market instruments were returned.",
    );
  return instruments;
}

export function parseHistory(body: unknown, code: string): Candle[] {
  if (
    !body ||
    typeof body !== "object" ||
    !("success" in body) ||
    body.success !== true ||
    !("data" in body)
  )
    throw new RadarProviderError("INDmoney could not return price history.");
  const data = body.data as Record<string, { candles?: unknown[] }>;
  const rows = data?.[code]?.candles;
  if (!Array.isArray(rows))
    throw new RadarProviderError(
      "No price history was returned for this instrument.",
    );
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    if (
      !r ||
      typeof r.ts !== "number" ||
      !Number.isFinite(r.ts) ||
      r.ts < 0 ||
      r.ts > 1e11
    )
      throw new RadarProviderError(
        "INDmoney returned invalid candle timestamps.",
      );
    const parsed = candleSchema.safeParse({
      date: todayIST(new Date(r.ts * 1000)),
      open: r.o,
      high: r.h,
      low: r.l,
      close: r.c,
      volume: r.v,
    });
    if (!parsed.success)
      throw new RadarProviderError(
        "INDmoney returned inconsistent prices. This history has not been saved.",
      );
    return parsed.data;
  });
}

/** Only two fixed read-only market endpoints are allowed. No broker account or order APIs. */
export class IndmoneyProvider {
  constructor(
    private token: string,
    private request: typeof fetch = fetch,
  ) {}
  private async get(
    path: "/market/instruments" | "/market/historical/1day",
    params: Record<string, string>,
  ) {
    const url = new URL(path, "https://api.indstocks.com");
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    let response: Response;
    try {
      response = await this.request(url, {
        method: "GET",
        headers: {
          Authorization: this.token,
          Accept:
            path === "/market/instruments" ? "text/csv" : "application/json",
        },
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
        redirect: "error",
      });
    } catch {
      throw new RadarProviderError(
        "INDmoney could not be reached. Try again later.",
      );
    }
    if (response.status === 401 || response.status === 403)
      throw new RadarProviderError(
        "Your INDmoney token has expired or access was denied. Update it in Vercel.",
      );
    if (response.status === 429)
      throw new RadarProviderError(
        "INDmoney's request limit was reached. Try again later.",
      );
    if (!response.ok)
      throw new RadarProviderError(
        "INDmoney could not return data. Try again later.",
      );
    const reader = response.body?.getReader();
    if (!reader)
      throw new RadarProviderError("INDmoney returned an empty response.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 20_000_000) {
        await reader.cancel();
        throw new RadarProviderError(
          "INDmoney returned more data than expected.",
        );
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    return new TextDecoder().decode(bytes);
  }
  async instruments() {
    return parseInstruments(
      await this.get("/market/instruments", { source: "equity" }),
    );
  }
  async history(
    instrument: Pick<RadarInstrument, "exchange" | "securityId">,
    today: string,
  ) {
    const code = `${instrument.exchange}_${instrument.securityId}`;
    const end = Date.parse(`${today}T00:00:00+05:30`);
    const start = end - 550 * 86400000;
    const all: Candle[] = [];
    // Daily API truncates windows over one year, so each request is explicitly bounded.
    for (let from = start; from < end;) {
      const to = Math.min(end, from + 365 * 86400000);
      const text = await this.get("/market/historical/1day", {
        "scrip-codes": code,
        start_time: String(from),
        end_time: String(to),
      });
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new RadarProviderError(
          "INDmoney returned an unreadable price response.",
        );
      }
      all.push(...parseHistory(body, code));
      from = to;
    }
    const byDate = new Map<string, Candle>();
    for (const c of all) {
      const existing = byDate.get(c.date);
      if (existing && JSON.stringify(existing) !== JSON.stringify(c))
        throw new RadarProviderError(
          "Conflicting prices were returned for the same session.",
        );
      if (c.date < today) byDate.set(c.date, c);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
}
