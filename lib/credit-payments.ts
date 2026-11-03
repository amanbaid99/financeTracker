import type { Card } from "./cards";
import { loanView, type Loan } from "./loans";

export interface CreditPayment {
  key: string;
  kind: "bill" | "emi" | "linked";
  name: string;
  amount: number;
  date: string | null;
  cardId?: string;
  loanId?: string;
  billId?: string;
  statementMonth?: string;
}

/** Overdue and current-month payments. Undated bills still need review. */
export function creditPayments(
  cards: Card[],
  loans: Loan[],
  today: string,
): CreditPayment[] {
  const month = today.slice(0, 7);
  const rows: CreditPayment[] = cards.flatMap((c) =>
    c.bills
      .filter(
        (b) =>
          !b.paid &&
          b.amount > 0 &&
          (b.dueDate
            ? b.dueDate.slice(0, 7) <= month
            : b.month.slice(0, 7) <= month),
      )
      .map((b) => ({
        key: `bill:${b.id}`,
        kind: "bill" as const,
        name: c.label,
        amount: b.amount,
        date: b.dueDate,
        cardId: c.id,
        billId: b.id,
        statementMonth: b.month,
      })),
  );
  for (const loan of loans) {
    const v = loanView(loan, today);
    if (!v.next || v.next.date.slice(0, 7) > month) continue;
    const linked =
      loan.type === "card" && cards.some((c) => c.id === loan.cardId);
    if (linked) {
      // Pending statements represent card payments. A paid statement in the
      // EMI month also needs no second payment. Loan recording stays separate.
      const card = cards.find((c) => c.id === loan.cardId)!;
      if (
        card.bills.some(
          (b) => !b.paid || b.dueDate?.slice(0, 7) === v.next!.date.slice(0, 7),
        )
      )
        continue;
    }
    rows.push({
      key: `loan:${loan.id}`,
      kind: linked ? "linked" : "emi",
      name: loan.name,
      amount: v.next.amount,
      date: v.next.date,
      loanId: loan.id,
      cardId: linked ? loan.cardId! : undefined,
    });
  }
  return rows.sort(
    (a, b) =>
      (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
      a.name.localeCompare(b.name),
  );
}
