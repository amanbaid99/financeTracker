// Liabilities: everything you owe and everything due, in one place.
// Pure: callers pass today and the data.

import { addMonths } from "./dates";
import { loanTotals, loanView, type Loan } from "./loans";
import { runway, type RunwayItem } from "./runway";

export interface Upcoming {
  key: string;
  label: string;
  amount: number;
  date: string;
  /** No date given: shown as due now. */
  undated: boolean;
  source: "emi" | "bill" | "item";
  loanId?: string;
  itemId?: string;
}

export interface Liabilities {
  /** Loans plus payments you've added (card dues and the like). */
  owed: number;
  loans: number;
  payments: number;
  monthlyEmi: number;
  debtFree: string | null;
  /** Everything due from today until `until`, by date. */
  upcoming: Upcoming[];
  until: string;
  dueTotal: number;
}

/**
 * What you owe and what's due. Between jobs the list runs till the latest
 * salary date; otherwise the next two months. Bills-fund payments that
 * repeat an EMI or living costs are left out, as on Covered till salary.
 */
export function liabilities(opts: {
  today: string;
  loans: Loan[];
  bills: { goalId: string; name: string; amount: number; date: string }[];
  items: RunwayItem[];
  choices: Record<string, boolean>;
  monthlyLiving: number;
  /** Latest salary date, while between jobs. */
  until?: string | null;
}): Liabilities {
  const until =
    opts.until && opts.until > opts.today
      ? opts.until
      : addMonths(opts.today, 2);
  const due = runway({
    today: opts.today,
    salaryBest: until,
    salaryWorst: until,
    investments: [],
    loans: opts.loans,
    monthlyLiving: opts.monthlyLiving,
    bills: opts.bills,
    items: opts.items,
    choices: opts.choices,
  }).worst.lines;
  const undated = new Set(
    opts.items.filter((i) => !i.due).map((i) => `item:${i.id}`),
  );
  const upcoming: Upcoming[] = due
    .filter((l) => l.counted && l.source !== "living")
    .map((l) => ({
      key: l.key,
      label: l.label,
      amount: l.amount,
      date: l.date,
      undated: undated.has(l.key),
      source: l.source as Upcoming["source"],
      loanId: l.source === "emi" ? l.key.split(":")[1] : undefined,
      itemId: l.itemId,
    }));
  const t = loanTotals(opts.loans.map((l) => loanView(l, opts.today)));
  const payments = opts.items
    .filter((i) => i.kind === "to_pay" && !i.done)
    .reduce((s, i) => s + i.amount, 0);
  return {
    owed: t.owed + payments,
    loans: t.owed,
    payments,
    monthlyEmi: t.monthlyEmi,
    debtFree: t.debtFree,
    upcoming,
    until,
    dueTotal: upcoming.reduce((s, u) => s + u.amount, 0),
  };
}
