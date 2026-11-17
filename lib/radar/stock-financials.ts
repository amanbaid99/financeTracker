import { z } from "zod";
import type { RadarInstrument } from "./contracts";

export const STOCK_FINANCIAL_ORIGIN = "https://stock.indianapi.in";
export type ReportKind = "annual" | "balance" | "cashflow";
export interface FinancialReport {
  kind: ReportKind;
  source: string;
  periods: { label: string; end: string }[];
  rows: { label: string; values: Record<string, number | null> }[];
  ignoredPeriods: string[];
}
export interface StockFinancials {
  provider: "IndianAPI";
  source: string;
  canonicalSymbol: string;
  identityMatch: "exact-nse-ticker";
  isinVerified: false;
  industry: string;
  fetchedAt: string;
  status: "collected" | "partial";
  reports: Partial<Record<ReportKind, FinancialReport>>;
  errors: string[];
  publicationTimesVerified: false;
  unitsVerified: false;
  currencyVerified: false;
  consolidationVerified: false;
  researchReady: false;
}
export class FinancialSourceError extends Error {}
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const reportKinds = { annual: "yoy_results", balance: "balancesheet", cashflow: "cashflow" } as const;
const symbolSchema = z.string().regex(/^[A-Z0-9&._-]{1,60}$/);
const validDate = (value: string) => {
  const time = Date.parse(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};
/** For BSE, resolve the NSE counterpart by the same ISIN, never a company-name guess. */
export function financialSymbol(item: Pick<RadarInstrument, "exchange" | "symbol" | "isin">, master: RadarInstrument[] = []): string | null {
  const candidates = item.exchange === "NSE" ? [item.symbol] : item.isin ?
    master.filter((i) => i.exchange === "NSE" && i.isin === item.isin).map((i) => i.symbol) : [];
  const symbols = [...new Set(candidates.map((s) => s.trim().toUpperCase()))];
  return symbols.length === 1 && symbolSchema.safeParse(symbols[0]).success ? symbols[0] : null;
}
function periodEnd(label: string) {
  const match = /^([A-Za-z]{3})\s+(\d{4})$/.exec(label);
  if (!match) return null;
  const month = months.findIndex((m) => m.toLowerCase() === match[1].toLowerCase());
  const year = Number(match[2]);
  return month >= 0 && year >= 1900 && year <= 2100
    ? new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10) : null;
}
const reportSchema = z.record(z.string().min(1).max(100), z.record(z.string().min(1).max(30), z.union([z.number().finite(), z.string().max(100), z.null()])));
/** Fiscal period end is not a publication date. Amount units and consolidation basis remain unknown. */
export function parseFinancialReport(body: unknown, kind: ReportKind, today: string): FinancialReport {
  if (!validDate(today)) throw new FinancialSourceError("A valid assessment date is required.");
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length > 100)
    throw new FinancialSourceError("The financial report format could not be verified.");
  const periods = new Map<string, string>(), ignored = new Set<string>();
  const rows: FinancialReport["rows"] = [];
  for (const [label, cells] of Object.entries(parsed.data)) {
    if (Object.keys(cells).length > 100) throw new FinancialSourceError("The report contained too many periods.");
    const values: Record<string, number | null> = {};
    for (const [period, raw] of Object.entries(cells)) {
      const end = periodEnd(period);
      if (!end || end > today) { ignored.add(period); continue; }
      periods.set(period, end);
      if (raw === null || ["", "-", "--", "N/A"].includes(String(raw).trim())) values[period] = null;
      else {
        const text = String(raw).trim();
        if (!/^-?\d+(?:\.\d+)?$/.test(text) || !Number.isFinite(Number(text)))
          throw new FinancialSourceError("A reported financial value could not be verified.");
        values[period] = Number(text);
      }
    }
    if (Object.keys(values).length) rows.push({ label, values });
  }
  if (!periods.size || !rows.length) throw new FinancialSourceError("No completed financial-report periods were returned.");
  return { kind, source: `${STOCK_FINANCIAL_ORIGIN}/historical_stats`,
    periods: [...periods].map(([label, end]) => ({ label, end })).sort((a, b) => a.end.localeCompare(b.end)),
    rows, ignoredPeriods: [...ignored].sort() };
}

export class IndianFinancialProvider {
  constructor(private key: string, private request: typeof fetch = fetch) {}
  private async get(path: "/stock" | "/historical_stats", params: Record<string, string>) {
    const url = new URL(path, STOCK_FINANCIAL_ORIGIN);
    Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
    let response: Response;
    try {
      response = await this.request(url, { method: "GET", headers: { "X-Api-Key": this.key, Accept: "application/json" },
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000) });
    } catch { throw new FinancialSourceError("The stock-financials source could not be reached."); }
    if (response.status === 400) throw new FinancialSourceError("The financial-data source rejected the request or key. Check the source configuration.");
    if ([401, 403].includes(response.status)) throw new FinancialSourceError("The stock-financials key was rejected. Check INDIANAPI_KEY in Vercel.");
    if (response.status === 404) throw new FinancialSourceError("This financial-data endpoint is not available on the configured plan.");
    if (response.status === 429) throw new FinancialSourceError("The financial-data source reached its credit or request limit. No upgrade has been made.");
    if (!response.ok) throw new FinancialSourceError("The financial-data source could not return a usable response.");
    const reader = response.body?.getReader();
    if (!reader) throw new FinancialSourceError("The financial-data response was empty.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 2_000_000) { await reader.cancel(); throw new Error("size"); }
        chunks.push(value);
      }
    } catch { throw new FinancialSourceError("The financial-data response could not be read within its limits."); }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new FinancialSourceError("The financial-data response was not valid JSON."); }
    if (!body || typeof body !== "object" || "error" in body)
      throw new FinancialSourceError("The financial-data source did not find a usable report for this instrument.");
    return body;
  }
  async financials(symbol: string, today: string, fetchedAt: string): Promise<StockFinancials> {
    const canonical = symbol.trim().toUpperCase();
    if (!symbolSchema.safeParse(canonical).success || !validDate(today) || !z.iso.datetime({ offset: true }).safeParse(fetchedAt).success)
      throw new FinancialSourceError("A valid stock identity and assessment time are required.");
    const identity = z.object({ tickerId: z.string().max(60), industry: z.string().max(160).nullish() }).safeParse(await this.get("/stock", { name: canonical }));
    if (!identity.success || identity.data.tickerId.trim().toUpperCase() !== canonical)
      throw new FinancialSourceError("The returned company did not match the exact NSE ticker. No name-based substitution was used.");
    const reports: StockFinancials["reports"] = {};
    const errors: string[] = [];
    const kinds = Object.keys(reportKinds) as ReportKind[];
    const reads = await Promise.allSettled(kinds.map(async (kind) => parseFinancialReport(
      await this.get("/historical_stats", { stock_name: canonical, stats: reportKinds[kind] }), kind, today,
    )));
    reads.forEach((read, i) => {
      if (read.status === "fulfilled") reports[kinds[i]] = read.value;
      else {
        const label = kinds[i] === "annual" ? "Annual results" : kinds[i] === "balance" ? "Balance sheet" : "Cash-flow report";
        const detail = read.reason instanceof FinancialSourceError ? read.reason.message : "The report could not be verified.";
        errors.push(`${label}: ${detail}`);
      }
    });
    if (!Object.keys(reports).length) throw new FinancialSourceError(errors[0] ?? "No company financial reports could be verified. Check source access and coverage.");
    return { provider: "IndianAPI", source: `${STOCK_FINANCIAL_ORIGIN}/stock`, canonicalSymbol: canonical,
      identityMatch: "exact-nse-ticker", isinVerified: false, industry: identity.data.industry?.trim() || "Not provided", fetchedAt,
      status: Object.keys(reports).length === kinds.length ? "collected" : "partial", reports, errors,
      publicationTimesVerified: false, unitsVerified: false, currencyVerified: false, consolidationVerified: false, researchReady: false };
  }
}

/** Reused reports keep their original retrieval time. A future or invalid time cannot pass. */
export function canReuseFinancials(evidence: StockFinancials | undefined, canonicalSymbol: string, now: string) {
  if (!evidence || evidence.canonicalSymbol !== canonicalSymbol) return false;
  const age = Date.parse(now) - Date.parse(evidence.fetchedAt);
  return Number.isFinite(age) && age >= 0 && age < 24 * 60 * 60 * 1000;
}
