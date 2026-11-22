import { describe, expect, it } from "vitest";
import {
  cardBillNudge,
  homeStatus,
  thisMonth,
  upcomingPayments,
} from "@/lib/home";
import type { Card } from "@/lib/cards";
import type { Loan } from "@/lib/loans";

const today = "2026-12-03";
const card = (id: string, months: string[]): Card =>
  ({
    id,
    label: id,
    annualFee: null,
    yearStart: null,
    rewards: null,
    benefits: [],
    bestFor: [],
    milestones: [],
    bills: months.map((month) => ({
      id: month,
      month,
      amount: 1000,
      dueDate: null,
      paid: false,
      note: null,
    })),
  }) as unknown as Card;

describe("cardBillNudge", () => {
  it("asks for last month's bills from the 1st until every card has one", () => {
    expect(
      cardBillNudge(
        [card("a", ["2026-11-01"]), card("b", ["2026-10-01"])],
        today,
      ),
    ).toEqual({ missing: 1, month: "2026-11-01" });
    expect(cardBillNudge([card("a", ["2026-11-01"])], today)).toBeNull();
    expect(cardBillNudge([card("a", ["2026-11-01"])], "2026-12-01")).toBeNull();
  });
});

describe("Home lists", () => {
  it("counts EMIs only, never loans on a card", () => {
    const loan = { id: "l", name: "Card EMI", cardId: "c1" } as unknown as Loan;
    expect(upcomingPayments([loan], today)).toEqual([]);
  });

  it("keeps card statements out of This month, since they have their own line", () => {
    const items = thisMonth({
      updates: [
        {
          key: "statement:c1:2026-11-01",
          title: "Log c1 statement",
          detail: "",
          href: "/cards",
        },
        {
          key: "cas",
          title: "Refresh your investments",
          detail: "",
          href: "/import",
        },
      ],
      milestone: null,
    });
    expect(items.map((i) => i.key)).toEqual(["cas"]);
  });

  it("says you're on track when nothing needs you", () => {
    expect(homeStatus({ payments: [], goals: [], today }).tone).toBe("success");
  });
});
