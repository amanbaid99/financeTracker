import { buildMonthBills, monthStart, type Bill } from "@/lib/bills";
import type { RawData } from "@/lib/data";
import type { FinanceData } from "@/lib/engine/types";
import { HOLDING_KIND_LABELS, LIABILITY_LABELS } from "@/lib/labels";

export type AccountPurpose = "spending" | "bills" | "savings";

export interface BankAccount {
  id: string;
  label: string;
  value: number;
  purpose: AccountPurpose;
}

export interface MonthStatus {
  month: string;
  bills: Bill[];
  paidKeys: string[];
  banks: BankAccount[];
  bankTotal: number;
  byPurpose: Record<AccountPurpose, number>;
  cardTotal: number;
  /** Card bills not yet ticked as paid (spend so far if not generated yet). */
  cardUnpaid: number;
  /** Other bills this month not yet ticked as paid. */
  otherUnpaid: number;
  /** Bank balance left after everything still due this month. */
  left: number;
  /** True when some accounts are marked for spending or bills. */
  hasSpendingAccounts: boolean;
  /** Spending + bills accounts left after everything still due. */
  spendingLeft: number;
  billsDueCount: number;
}

/** Where your money stands this month: bills due, bank balances by purpose, what's left. */
export function monthStatus(raw: RawData, data: FinanceData, today: string): MonthStatus {
  const bills: Bill[] = buildMonthBills({
    todayISO: today,
    cards: raw.cards.map((c) => ({
      id: c.id,
      label: c.label,
      outstanding: c.outstanding,
      dueDay: c.due_day,
      statementDay: c.statement_day,
    })),
    monthBills: raw.monthBills.map((r) => ({
      id: r.id,
      month: r.month,
      seriesId: r.series_id,
      label: r.label,
      amount: r.amount,
      dueDay: r.due_day,
      recurring: r.recurring,
      cardId: r.card_id,
    })),
    emis: raw.liabilities
      .filter((l) => (l.emi ?? 0) > 0 && l.outstanding > 0)
      .map((l) => ({ id: l.id, label: `${l.label || LIABILITY_LABELS[l.kind]} EMI`, emi: l.emi ?? 0 })),
    insurance: raw.insurance.map((p) => ({
      id: p.id,
      label: `${p.kind === "term" ? "Term" : p.kind === "health" ? "Health" : "Other"} insurance${p.covers === "others" ? " (family)" : ""}`,
      premium: p.premium,
      frequency: p.premium_frequency as "monthly" | "quarterly" | "half_yearly" | "yearly",
      debitDay: p.debit_day,
      renewalDate: p.renewal_date,
      renewalMonth: p.renewal_month,
    })),
    planned: raw.planned.map((p) => ({ id: p.id, name: p.name, amount: p.amount, nextDue: p.next_due })),
    sips: raw.holdings
      .filter((h) => (h.monthly_sip ?? 0) > 0)
      .map((h) => ({ id: h.id, label: h.name || HOLDING_KIND_LABELS[h.kind], sip: h.monthly_sip ?? 0 })),
  });

  // Planned expenses roll forward once paid, so show this month's paid ones too.
  const paidKeys = raw.billStatus.filter((b) => b.paid).map((b) => b.bill_key);
  for (const key of paidKeys) {
    if (!key.startsWith("plan:") || bills.some((b) => b.key === key)) continue;
    const [, id, due] = key.split(":");
    const p = raw.planned.find((x) => x.id === id);
    if (p) {
      bills.push({ key, kind: "planned", label: p.name, amount: p.amount, dueDate: due ?? null, status: "due", plannedId: id });
    }
  }

  const banks: BankAccount[] = raw.holdings
    .filter((h) => h.kind === "savings")
    .map((h) => ({
      id: h.id,
      label: h.name || "Bank account",
      value: h.current_value,
      purpose: (h.purpose as AccountPurpose | null) ?? "savings",
    }));
  const byPurpose: Record<AccountPurpose, number> = { spending: 0, bills: 0, savings: 0 };
  for (const b of banks) byPurpose[b.purpose] += b.value;
  const bankTotal = banks.reduce((s, b) => s + b.value, 0);

  const paid = new Set(paidKeys);
  const cardTotal = (data.cards ?? []).reduce((s, c) => s + c.outstanding, 0);
  // Card bills ticked as paid this month have already left the bank. A card
  // whose bill isn't generated yet still counts its spend so far.
  const cardUnpaid = bills
    .filter((b) => b.kind === "card" && !paid.has(b.key))
    .reduce((s, b) => s + (b.amount ?? b.estimate ?? 0), 0);
  const otherUnpaid = bills
    .filter((b) => b.kind !== "card" && !paid.has(b.key))
    .reduce((s, b) => s + (b.amount ?? 0), 0);
  const hasSpendingAccounts = byPurpose.spending + byPurpose.bills > 0 || banks.some((b) => b.purpose !== "savings");

  return {
    month: monthStart(today),
    bills,
    paidKeys,
    banks,
    bankTotal,
    byPurpose,
    cardTotal,
    cardUnpaid,
    otherUnpaid,
    left: bankTotal - cardUnpaid - otherUnpaid,
    hasSpendingAccounts,
    spendingLeft: byPurpose.spending + byPurpose.bills - cardUnpaid - otherUnpaid,
    billsDueCount: bills.filter((b) => !paid.has(b.key) && b.kind !== "sip").length,
  };
}
