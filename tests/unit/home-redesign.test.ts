import { describe, expect, it } from "vitest";
import {
  homeStatus,
  thisMonth,
  upcomingPayments,
  type Payment,
} from "@/lib/home";
import type { Card } from "@/lib/cards";
import type { Loan } from "@/lib/loans";

const today = "2026-11-22";
const card = (bills: Card["bills"]): Card =>
  ({
    id: "c1",
    label: "My card",
    annualFee: null,
    yearStart: null,
    rewards: null,
    benefits: [],
    bestFor: [],
    milestones: [],
    bills,
  }) as unknown as Card;
const bill = (dueDate: string, paid = false) => ({
  id: dueDate,
  month: "2026-11-01",
  amount: 12000,
  dueDate,
  paid,
  note: null,
});

describe("upcomingPayments", () => {
  it("lists unpaid card bills within 30 days, soonest first, and skips paid ones", () => {
    const p = upcomingPayments(
      [
        card([
          bill("2026-12-10"),
          bill("2026-11-20"),
          bill("2026-12-05", true),
          bill("2027-02-01"),
        ]),
      ],
      [],
      today,
    );
    expect(p.map((x) => [x.date, x.overdue])).toEqual([
      ["2026-11-20", true],
      ["2026-12-10", false],
    ]);
  });

  it("leaves out EMIs of loans on a card, since the card bill includes them", () => {
    const loan = { id: "l", name: "Card EMI", cardId: "c1" } as unknown as Loan;
    expect(upcomingPayments([], [loan], today)).toEqual([]);
  });
});

describe("homeStatus and thisMonth", () => {
  const late: Payment = {
    key: "b",
    name: "My card bill",
    amount: 12000,
    date: "2026-11-20",
    kind: "card",
    overdue: true,
    href: "/cards",
  };
  it("puts an overdue payment first, in red", () => {
    expect(homeStatus({ payments: [late], goals: [], today })).toEqual({
      tone: "danger",
      text: "My card bill of ₹12,000 was due 20 Nov.",
    });
    const items = thisMonth({
      payments: [late],
      updates: [],
      steps: [],
      milestone: null,
      today,
    });
    expect(items[0]).toMatchObject({
      title: "Pay My card bill: ₹12,000",
      detail: "Was due 20 Nov",
      snooze: false,
    });
  });
  it("says you're on track when nothing needs you", () => {
    expect(homeStatus({ payments: [], goals: [], today }).tone).toBe("success");
  });
});
