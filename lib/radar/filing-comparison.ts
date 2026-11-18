import { z } from "zod";
import references from "./filing-references.json";
import type { StockFinancials, ReportKind } from "./stock-financials";
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const decimal = z.string().max(60).regex(/^-?\d+(?:\.\d+)?$/);
const referenceSchema = z.object({
  isin: z.string().regex(/^IN[A-Z0-9]{10}$/), fiscalEnd: date, basis: z.literal("consolidated"),
  source: z.url().refine((s) => { const u = new URL(s); return u.protocol === "https:" && u.hostname === "nsearchives.nseindia.com" && !u.username && !u.password && !u.port && !u.search && !u.hash && /^\/corporate\/ixbrl\/INTEGRATED_FILING_INDAS_\d+_\d{14}_iXBRL_WEB\.html$/.test(u.pathname); }),
  reviewedOn: date, provenance: z.literal("reviewed-source-sample"), valuationReady: z.literal(false),
  facts: z.array(z.object({ metric: z.string().max(60), periodEnd: date,
    periodKind: z.enum(["annual", "point-in-time"]), basis: z.literal("consolidated"),
    dimension: z.enum(["amount", "per-share"]), unit: z.enum(["INR-lakh", "INR-crore", "INR", "INR/share"]),
    reportedValue: decimal, normalizedValue: decimal }).refine((f) => f.dimension === "per-share" ? f.unit === "INR/share" : f.unit !== "INR/share")).max(30),
}).refine((r) => r.reviewedOn >= r.fiscalEnd);
export type ReviewedFiling = z.infer<typeof referenceSchema>;
export interface FilingComparison {
  periodEnd: string; reviewedOn: string; source: string;
  rows: { label: string; state: "conditional-match" | "needs-review" | "unavailable" | "definition-unverified" }[];
  conditionalMatches: number;
  providerScaleVerified: false;
  valuationReady: false;
}
const fields: { metric: string; label: string; kind: ReportKind; sourceLabel: string; periodKind: "annual" | "point-in-time" }[] = [
  { metric: "revenue", label: "Revenue", kind: "annual", sourceLabel: "Sales", periodKind: "annual" },
  { metric: "net-profit", label: "Net profit", kind: "annual", sourceLabel: "Net Profit", periodKind: "annual" },
  { metric: "operating-cash", label: "Operating cash flow", kind: "cashflow", sourceLabel: "Cash from Operating Activity", periodKind: "annual" },
  { metric: "total-assets", label: "Total assets", kind: "balance", sourceLabel: "Total Assets", periodKind: "point-in-time" },
  { metric: "diluted-eps", label: "Earnings per share", kind: "annual", sourceLabel: "EPS in Rs", periodKind: "annual" },
];
/** Exact integer-rupee comparison, never a floating percentage tolerance or inferred fractional amount. */
function integerValue(value: string, scale: number): bigint | null {
  if (!decimal.safeParse(value).success) return null;
  const [whole, fraction = ""] = value.split(".");
  let coefficient = BigInt(whole + fraction), power = scale - fraction.length;
  while (power < 0 && coefficient % BigInt(10) === BigInt(0)) { coefficient /= BigInt(10); power++; }
  if (power < 0) return null;
  const normalized = coefficient * BigInt(10) ** BigInt(power);
  return normalized > BigInt(Number.MAX_SAFE_INTEGER) || normalized < -BigInt(Number.MAX_SAFE_INTEGER) ? null : normalized;
}
export function reviewedFiling(isin: string | null | undefined): ReviewedFiling | undefined {
  const matches = references.filter((r) => r.isin === isin);
  if (matches.length !== 1) return;
  const result = referenceSchema.safeParse(matches[0]);
  return result.success ? result.data : undefined;
}
/** Hypothesis only: three numeric agreements cannot verify the provider's scale, basis or full history. */
export function compareFiling(evidence: StockFinancials, input: ReviewedFiling, expectedIsin: string): FilingComparison | null {
  const parsed = referenceSchema.safeParse(input);
  if (!parsed.success || parsed.data.isin !== expectedIsin) return null;
  const reference = parsed.data;
  const identity = evidence.identityMatch === "same-isin" && evidence.identityIsin === expectedIsin;
  const rows: FilingComparison["rows"] = fields.map((field) => {
    const report = evidence.reports[field.kind];
    const periods = report?.periods.filter((p) => p.end === reference.fiscalEnd) ?? [];
    const sourceRows = report?.rows.filter((r) => r.label === field.sourceLabel) ?? [];
    const facts = reference.facts.filter((f) => f.metric === field.metric && f.periodEnd === reference.fiscalEnd && f.periodKind === field.periodKind);
    if (!identity || periods.length !== 1 || sourceRows.length !== 1 || facts.length !== 1) return { label: field.label, state: "unavailable" };
    const value = sourceRows[0].values[periods[0].label], fact = facts[0];
    if (typeof value !== "number" || !Number.isFinite(value)) return { label: field.label, state: "unavailable" };
    // "EPS in Rs" does not identify recurring/diluted/share-adjusted earnings.
    if (field.metric === "diluted-eps") return { label: field.label, state: "definition-unverified" };
    if (fact.dimension !== "amount" || fact.unit === "INR/share") return { label: field.label, state: "unavailable" };
    const reported = integerValue(String(value), 7), filing = integerValue(fact.normalizedValue, 0);
    const sourceScale = fact.unit === "INR-lakh" ? 5 : fact.unit === "INR-crore" ? 7 : 0;
    if (integerValue(fact.reportedValue, sourceScale) !== filing) return { label: field.label, state: "unavailable" };
    return { label: field.label, state: reported === null || filing === null ? "unavailable" : reported === filing ? "conditional-match" : "needs-review" };
  });
  return { periodEnd: reference.fiscalEnd, reviewedOn: reference.reviewedOn, source: reference.source,
    rows, conditionalMatches: rows.filter((r) => r.state === "conditional-match").length,
    providerScaleVerified: false, valuationReady: false };
}
