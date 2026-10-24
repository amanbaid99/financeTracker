// Works out which bills fall in a given month. Pure: no I/O, today is passed in.
import { parseISODate, toISODate } from "@/lib/engine/dates";

export type BillKind = "card" | "emi" | "insurance" | "planned" | "sip";

export interface Bill {
  key: string;
  kind: BillKind;
  label: string;
  amount: number;
  /** Due date this month, if known. */
  dueDate: string | null;
  overdue?: boolean;
  /** For planned expenses: advance the next due date when marked paid. */
  plannedId?: string;
}

export interface BillInputs {
  todayISO: string;
  cards: { id: string; label: string; outstanding: number; dueDay: number | null }[];
  emis: { id: string; label: string; emi: number }[];
  insurance: {
    id: string;
    label: string;
    /** Amount per payment. */
    premium: number | null;
    frequency: "monthly" | "quarterly" | "half_yearly" | "yearly";
    debitDay: number | null;
    renewalDate: string | null;
    renewalMonth: number | null;
  }[];
  planned: { id: string; name: string; amount: number; nextDue: string | null }[];
  sips: { id: string; label: string; sip: number }[];
}

const MONTHS_BETWEEN: Record<BillInputs["insurance"][number]["frequency"], number> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

function dayInMonth(y: number, m: number, day: number): string {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return toISODate({ y, m, d: Math.min(Math.max(1, day), last) });
}

export function monthStart(todayISO: string): string {
  return `${todayISO.slice(0, 7)}-01`;
}

export function buildMonthBills(input: BillInputs): Bill[] {
  const { y, m } = parseISODate(input.todayISO);
  const monthEnd = dayInMonth(y, m, 31);
  const bills: Bill[] = [];

  for (const c of input.cards) {
    if (c.outstanding <= 0) continue;
    bills.push({
      key: `card:${c.id}`,
      kind: "card",
      label: `${c.label} bill`,
      amount: c.outstanding,
      dueDate: c.dueDay ? dayInMonth(y, m, c.dueDay) : null,
    });
  }

  for (const e of input.emis) {
    if (e.emi > 0) bills.push({ key: `emi:${e.id}`, kind: "emi", label: e.label, amount: e.emi, dueDate: null });
  }

  for (const p of input.insurance) {
    if (!p.premium) continue;
    const step = MONTHS_BETWEEN[p.frequency];
    if (p.frequency === "monthly") {
      bills.push({
        key: `ins:${p.id}`,
        kind: "insurance",
        label: p.label,
        amount: p.premium,
        dueDate: p.debitDay ? dayInMonth(y, m, p.debitDay) : null,
      });
      continue;
    }
    const anchor = p.renewalDate ? parseISODate(p.renewalDate) : null;
    const anchorMonth = anchor?.m ?? p.renewalMonth;
    if (!anchorMonth) continue;
    if ((((m - anchorMonth) % step) + step) % step !== 0) continue;
    bills.push({
      key: `ins:${p.id}`,
      kind: "insurance",
      label: p.label,
      amount: p.premium,
      dueDate: anchor ? dayInMonth(y, m, anchor.d) : null,
    });
  }

  for (const p of input.planned) {
    if (!p.nextDue || p.nextDue > monthEnd) continue;
    bills.push({
      key: `plan:${p.id}:${p.nextDue}`,
      kind: "planned",
      label: p.name,
      amount: p.amount,
      dueDate: p.nextDue,
      overdue: p.nextDue < monthStart(input.todayISO),
      plannedId: p.id,
    });
  }

  for (const s of input.sips) {
    if (s.sip > 0) bills.push({ key: `sip:${s.id}`, kind: "sip", label: `${s.label} SIP`, amount: s.sip, dueDate: null });
  }

  return bills.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
}
