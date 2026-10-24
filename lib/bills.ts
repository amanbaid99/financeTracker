// Works out which bills fall in a given month. Pure: no I/O, today is passed in.
import { parseISODate, toISODate } from "@/lib/engine/dates";

export type BillKind = "card" | "emi" | "insurance" | "planned" | "sip" | "custom";

/** not_generated: the bill isn't out yet; due / overdue by due date; this_month: no date. */
export type BillStatus = "not_generated" | "due" | "overdue" | "this_month";

export interface Bill {
  key: string;
  kind: BillKind;
  label: string;
  /** Billed amount, or null when the bill isn't generated yet. */
  amount: number | null;
  /** Spend so far on a card whose bill isn't generated yet. */
  estimate?: number;
  /** Due date this month, if known. */
  dueDate: string | null;
  /** When a card statement is generated this month. */
  generatesOn?: string;
  status: BillStatus;
  overdue?: boolean;
  /** For planned expenses: advance the next due date when marked paid. */
  plannedId?: string;
  /** What the "enter amount" control edits. */
  edit?:
    | { type: "card"; cardId: string; rowId: string | null }
    | { type: "custom"; seriesId: string; rowId: string | null; recurring: boolean; dueDay: number | null };
}

export interface BillInputs {
  todayISO: string;
  cards: { id: string; label: string; outstanding: number; dueDay: number | null; statementDay?: number | null }[];
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
  /**
   * Rows from month_bills: this month's rows plus the latest row of every
   * repeating series. Card rows hold the billed amount for that card.
   */
  monthBills?: {
    id: string;
    month: string;
    seriesId: string;
    label: string;
    amount: number | null;
    dueDay: number | null;
    recurring: boolean;
    cardId: string | null;
  }[];
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

  const today = input.todayISO;
  const thisMonth = monthStart(today);
  const rows = input.monthBills ?? [];
  const statusFor = (due: string | null): BillStatus => (due ? (due < today ? "overdue" : "due") : "this_month");

  for (const c of input.cards) {
    const billed = rows.find((r) => r.cardId === c.id && r.month === thisMonth);
    const due = c.dueDay ? dayInMonth(y, m, c.dueDay) : null;
    // A statement due this month is generated this month when the statement
    // day comes before the due day; otherwise it came out last month.
    const generatesOn =
      c.statementDay && c.dueDay && c.statementDay <= c.dueDay ? dayInMonth(y, m, c.statementDay) : undefined;
    const notYet = !billed?.amount && generatesOn !== undefined && today < generatesOn;
    if (!notYet && !billed && c.outstanding <= 0) continue;
    bills.push({
      key: `card:${c.id}`,
      kind: "card",
      label: `${c.label} bill`,
      amount: notYet ? null : (billed?.amount ?? c.outstanding),
      estimate: notYet ? c.outstanding : undefined,
      dueDate: due,
      generatesOn,
      status: notYet ? "not_generated" : statusFor(due),
      edit: { type: "card", cardId: c.id, rowId: billed?.id ?? null },
    });
  }

  // Bills the user added: this month's rows, plus repeating ones not yet entered this month.
  const series = new Map<string, NonNullable<BillInputs["monthBills"]>[number]>();
  for (const r of rows.filter((x) => !x.cardId)) {
    const cur = series.get(r.seriesId);
    if (r.month === thisMonth) series.set(r.seriesId, r);
    else if (r.recurring && r.month < thisMonth && (!cur || (cur.month !== thisMonth && r.month > cur.month))) {
      series.set(r.seriesId, r);
    }
  }
  for (const r of series.values()) {
    const isThisMonth = r.month === thisMonth;
    const amount = isThisMonth ? r.amount : null;
    const due = r.dueDay ? dayInMonth(y, m, r.dueDay) : null;
    bills.push({
      key: `bill:${r.seriesId}`,
      kind: "custom",
      label: r.label,
      amount,
      dueDate: due,
      status: amount === null ? "not_generated" : statusFor(due),
      edit: { type: "custom", seriesId: r.seriesId, rowId: isThisMonth ? r.id : null, recurring: r.recurring, dueDay: r.dueDay },
    });
  }

  for (const e of input.emis) {
    if (e.emi > 0) {
      bills.push({ key: `emi:${e.id}`, kind: "emi", label: e.label, amount: e.emi, dueDate: null, status: "this_month" });
    }
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
        status: statusFor(p.debitDay ? dayInMonth(y, m, p.debitDay) : null),
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
      status: statusFor(anchor ? dayInMonth(y, m, anchor.d) : null),
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
      status: statusFor(p.nextDue),
      plannedId: p.id,
    });
  }

  for (const s of input.sips) {
    if (s.sip > 0) {
      bills.push({ key: `sip:${s.id}`, kind: "sip", label: `${s.label} SIP`, amount: s.sip, dueDate: null, status: "this_month" });
    }
  }

  return bills.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
}
