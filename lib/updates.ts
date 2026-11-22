import { addMonths, emiDateIn, parseISODate, todayIST } from "./dates";
import type { Card } from "./cards";
import type { Loan } from "./loans";

export interface UpdateDue {
  key: string;
  title: string;
  detail: string;
  href: string;
  actionLabel?: string;
  /** False for things that can't wait (payments, plan steps): no Tomorrow button. */
  snooze?: boolean;
  /** A payment that can be marked paid from here. */
  pay?: { billId: string } | { loanId: string; dueDate: string };
}

/** Missing information asks for an update, never implies a missed payment. */
export function updatesDue({
  today,
  cards,
  loans,
  lastCas,
  hasFunds,
  snoozes = {},
}: {
  today: string;
  cards: Card[];
  loans: Loan[];
  lastCas: string | null;
  hasFunds: boolean;
  snoozes?: Record<string, unknown>;
}): UpdateDue[] {
  const month = today.slice(0, 7);
  const casMonth = lastCas ? todayIST(new Date(lastCas)).slice(0, 7) : null;
  const items: UpdateDue[] = [];
  for (const c of cards) {
    if (!c.statementDay) continue;
    const { y, m } = parseISODate(today);
    const latest =
      emiDateIn(y, m, c.statementDay) <= today
        ? `${month}-01`
        : addMonths(`${month}-01`, -1);
    if (c.bills.some((b) => b.month === latest)) continue;
    items.push({
      key: `statement:${c.id}:${latest}`,
      title: `Log ${c.label} statement`,
      actionLabel:"Log bill",
      detail: `${new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(latest))}. Add the statement amount for milestone progress.`,
      href: `/cards?do=${encodeURIComponent(`bill:${c.id}:${latest.slice(0, 7)}`)}`,
    });
  }
  const loanMonth =
    today.slice(8) >= "02" ? month : addMonths(`${month}-01`, -1).slice(0, 7);
  {
    for (const l of loans) {
      if (
        l.outstanding <= 0 ||
        (l.confirmedOn && l.confirmedOn.slice(0, 7) >= loanMonth)
      )
        continue;
      items.push({
        key: `loan:${l.id}:${loanMonth}`,
        title: `Update ${l.name} balance`,
        actionLabel:"Update balance",
        detail: "Confirm this month's outstanding amount from your lender.",
        href: `/updates?loan=${l.id}`,
      });
    }
  }
  const refreshMonth =
    today.slice(8) >= "05" ? month : addMonths(`${month}-01`, -1).slice(0, 7);
  if (hasFunds && (!casMonth || casMonth < refreshMonth))
    items.push({
      key: `cas:${refreshMonth}`,
      title: "Refresh your investments",
      actionLabel:"Upload CAS",
      detail:
        "Upload a recent CAS. Review current balances before saving.",
      href: "/import",
    });
  return items.filter(
    (i) =>
      typeof snoozes[i.key] !== "string" || (snoozes[i.key] as string) <= today,
  );
}
