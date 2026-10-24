const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** ₹12,34,567 */
export function formatINR(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "₹0";
  return inr.format(Math.round(n));
}

/** ₹12.3L, ₹1.25Cr, ₹45,000 */
export function formatINRCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "₹0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const trim = (x: number) => (x >= 100 ? x.toFixed(0) : x.toFixed(x >= 10 ? 1 : 2)).replace(/\.?0+$/, "");
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  return formatINR(n);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthName(m: number | null | undefined): string {
  if (!m || m < 1 || m > 12) return "";
  return MONTHS[m - 1];
}

/** 2027-03-15 -> 15 Mar 2027 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatMonths(months: number | null): string {
  if (months === null) return "";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y} yr${y === 1 ? "" : "s"}${m ? ` ${m} mo` : ""}`;
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

/** Parses "1,20,000" or "120000" into integer rupees. */
export function parseRupees(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input) : null;
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}
