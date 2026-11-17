import type { StockFinancials, ReportKind } from "./stock-financials";

const fields: { id: string; label: string; kind: ReportKind; aliases: string[] }[] = [
  { id: "revenue", label: "Revenue", kind: "annual", aliases: ["Sales", "Revenue from operations"] },
  { id: "profit", label: "Net profit", kind: "annual", aliases: ["Net Profit"] },
  { id: "eps", label: "Reported earnings per share", kind: "annual", aliases: ["EPS in Rs"] },
  { id: "ebitda", label: "Operating earnings (EBITDA)", kind: "annual", aliases: ["EBITDA"] },
  { id: "debt", label: "Borrowings", kind: "balance", aliases: ["Borrowings"] },
  { id: "cash", label: "Cash balance", kind: "balance", aliases: ["Cash and cash equivalents"] },
  { id: "operatingCash", label: "Operating cash flow", kind: "cashflow", aliases: ["Cash from Operating Activity"] },
  { id: "capitalSpending", label: "Capital spending", kind: "cashflow", aliases: ["Capital expenditure"] },
];
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
export interface ReportCoverage {
  sharedPeriods: string[];
  consecutiveYears: boolean;
  fields: { id: string; label: string; state: "collected" | "absent" | "ambiguous" | "incomplete" }[];
  /** Structural coverage never establishes verified financial inputs. */
  valuationReady: false;
}
/** Align full fiscal period ends, never nearest dates, row positions or an interim balance sheet. */
export function stockReportCoverage(evidence: StockFinancials): ReportCoverage {
  const kinds: ReportKind[] = ["annual", "balance", "cashflow"];
  const periods = Object.fromEntries(kinds.map((kind) => {
    const byEnd = new Map<string, string[]>();
    for (const p of evidence.reports[kind]?.periods ?? []) {
      if (!validDate(p.end)) continue;
      byEnd.set(p.end, [...(byEnd.get(p.end) ?? []), p.label]);
    }
    return [kind, byEnd];
  })) as Record<ReportKind, Map<string, string[]>>;
  const sharedPeriods = [...periods.annual.keys()].filter((end) => kinds.every((kind) => periods[kind].get(end)?.length === 1)).sort();
  const latest = sharedPeriods.slice(-3);
  const consecutiveYears = latest.length === 3 && latest.every((end, i) => i === 0 ||
    (Date.parse(end) - Date.parse(latest[i - 1])) / 86_400_000 >= 330 && (Date.parse(end) - Date.parse(latest[i - 1])) / 86_400_000 <= 400);
  return {
    sharedPeriods, consecutiveYears, valuationReady: false,
    fields: fields.map(({ id, label, kind, aliases }) => {
      const rows = evidence.reports[kind]?.rows.filter((r) => aliases.includes(r.label.trim())) ?? [];
      const state = rows.length === 0 ? "absent" : rows.length > 1 ? "ambiguous" :
        !consecutiveYears || latest.some((end) => {
          const value = rows[0].values[periods[kind].get(end)![0]];
          return typeof value !== "number" || !Number.isFinite(value);
        }) ? "incomplete" : "collected";
      return { id, label, state };
    }),
  };
}
