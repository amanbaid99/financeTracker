import { describe, expect, it } from "vitest";
import { creditPayments } from "@/lib/credit-payments";
import type { Card } from "@/lib/cards";
import type { Loan } from "@/lib/loans";
const today = "2026-11-03";
const loan: Loan = {
  id: "loan",
  name: "Loan",
  type: "personal",
  cardId: null,
  principal: 100000,
  takenOn: null,
  ratePct: 10,
  emi: 5000,
  monthsLeft: null,
  totalEmis: null,
  emiDay: 5,
  billDay: null,
  firstEmi: null,
  outstanding: 50000,
  asOf: "2026-10-05",
  foreclosurePct: null,
  foreclosureGst: false,
  payments: [],
  goal: null,
};
const card: Card = {
  id: "card",
  label: "Everyday card",
  annualFee: null,
  yearStart: null,
  rewards: null,
  benefits: [],
  bestFor: [],
  milestones: [],
  bills: [],
};
const bill = {
  id: "bill",
  month: "2026-10-01",
  amount: 8000,
  dueDate: "2026-11-02",
  paid: false,
  note: null,
};
describe("credit payment queue", () => {
  it("orders overdue bills before upcoming EMIs and undated bills, excluding paid bills and closed loans", () => {
    const cards = [
      {
        ...card,
        bills: [
          { ...bill, id: "unknown", dueDate: null },
          { ...bill, id: "paid", paid: true },
          bill,
        ],
      },
    ];
    const rows = creditPayments(
      cards,
      [loan, { ...loan, id: "closed", outstanding: 0 }],
      today,
    );
    expect(rows.map((r) => r.key)).toEqual([
      "bill:bill",
      "loan:loan",
      "bill:unknown",
    ]);
    expect(cards[0].bills[0].id).toBe("unknown");
  });
  it("never lists a linked EMI as another payment when there is an unpaid bill", () => {
    expect(
      creditPayments(
        [{ ...card, bills: [bill] }],
        [{ ...loan, type: "card", cardId: card.id }],
        today,
      ).map((r) => r.kind),
    ).toEqual(["bill"]);
    expect(
      creditPayments(
        [{ ...card, bills: [{ ...bill, dueDate: null }] }],
        [{ ...loan, type: "card", cardId: card.id }],
        today,
      ).map((r) => r.kind),
    ).toEqual(["bill"]);
  });
  it("does not recreate a second payment after the linked bill was marked paid", () => {
    expect(
      creditPayments(
        [{ ...card, bills: [{ ...bill, paid: true }] }],
        [{ ...loan, type: "card", cardId: card.id }],
        today,
      ),
    ).toEqual([]);
  });
  it("shows an informational card reminder if the statement is missing, and treats separate-card loans as independent EMIs", () => {
    expect(
      creditPayments(
        [card],
        [{ ...loan, type: "card", cardId: card.id }],
        today,
      )[0],
    ).toMatchObject({ kind: "linked", cardId: card.id });
    expect(
      creditPayments(
        [card],
        [{ ...loan, type: "card", cardId: null }],
        today,
      )[0].kind,
    ).toBe("emi");
  });
});
