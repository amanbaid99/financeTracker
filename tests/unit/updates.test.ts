import { describe, expect, it } from "vitest";
import { updatesDue } from "@/lib/updates";
import { loanState } from "@/lib/loan";
import type { Card } from "@/lib/cards";
import type { Loan } from "@/lib/loans";

const card: Card = {
  id: "c",
  label: "My card",
  annualFee: null,
  statementDay: 20,
  yearStart: null,
  rewards: null,
  benefits: [],
  bestFor: [],
  milestones: [],
  bills: [],
};
const loan: Loan = {
  id: "l",
  name: "My loan",
  type: "personal",
  cardId: null,
  principal: 100000,
  takenOn: null,
  ratePct: 9,
  emi: 5000,
  monthsLeft: null,
  totalEmis: null,
  emiDay: 10,
  billDay: null,
  firstEmi: null,
  outstanding: 80000,
  asOf: "2026-10-01",
  foreclosurePct: null,
  foreclosureGst: false,
  payments: [],
  goal: null,
};
const base = {
  today: "2026-11-16",
  cards: [] as Card[],
  loans: [] as Loan[],
  lastCas: null,
  hasFunds: false,
};

describe("updates due", () => {
  it("targets the latest generated statement, including month-end and year rollover", () => {
    expect(updatesDue({ ...base, cards: [card] })[0].key).toBe(
      "statement:c:2026-10-01",
    );
    const onDay = updatesDue({
      ...base,
      today: "2026-11-20",
      cards: [card],
    })[0];
    expect(onDay.key).toBe("statement:c:2026-11-01");
    expect(decodeURIComponent(onDay.href)).toContain("bill:c:2026-11");
    expect(
      updatesDue({ ...base, today: "2027-01-01", cards: [card] })[0].key,
    ).toBe("statement:c:2026-12-01");
    expect(
      updatesDue({
        ...base,
        today: "2027-02-28",
        cards: [{ ...card, statementDay: 31 }],
      })[0].key,
    ).toBe("statement:c:2027-02-01");
  });
  it("clears on logging the requested month, ignoring legacy payment flags", () => {
    const logged = {
      ...card,
      bills: [
        {
          id: "b",
          month: "2026-10-01",
          amount: 0,
          paid: false,
          dueDate: "2026-10-22",
          note: null,
        },
      ],
    };
    expect(updatesDue({ ...base, cards: [logged] })).toEqual([]);
    expect(
      updatesDue({ ...base, cards: [{ ...card, statementDay: null }] }),
    ).toEqual([]);
  });
  it("starts monthly loan checks on the 2nd, keeps stale checks, and resets next month", () => {
    expect(
      updatesDue({
        ...base,
        today: "2026-11-01",
        loans: [{ ...loan, confirmedOn: "2026-10-02" }],
      }),
    ).toEqual([]);
    expect(
      updatesDue({ ...base, today: "2026-11-02", loans: [loan] }),
    ).toHaveLength(1);
    expect(
      updatesDue({ ...base, loans: [{ ...loan, confirmedOn: "2026-11-01" }] }),
    ).toEqual([]);
    expect(
      updatesDue({
        ...base,
        today: "2026-12-02",
        loans: [{ ...loan, confirmedOn: "2026-11-30" }],
      }),
    ).toHaveLength(1);
    expect(
      updatesDue({ ...base, loans: [{ ...loan, outstanding: 0 }] }),
    ).toEqual([]);
  });
  it("starts CAS on the 5th only for mutual fund holders and clears after refresh", () => {
    expect(
      updatesDue({
        ...base,
        hasFunds: true,
        today: "2026-11-04",
        lastCas: "2026-10-05T10:00:00Z",
      }),
    ).toEqual([]);
    expect(
      updatesDue({ ...base, hasFunds: true, today: "2026-11-05" }),
    ).toHaveLength(1);
    expect(
      updatesDue({ ...base, hasFunds: true, lastCas: "2026-11-01T10:00:00Z" }),
    ).toEqual([]);
    expect(updatesDue(base)).toEqual([]);
  });
  it("keeps overdue updates visible across the month boundary", () => {
    expect(
      updatesDue({ ...base, today: "2026-12-01", loans: [loan] })[0].key,
    ).toBe("loan:l:2026-11");
    expect(
      updatesDue({
        ...base,
        today: "2026-12-01",
        hasFunds: true,
        lastCas: "2026-10-05T10:00:00Z",
      })[0].key,
    ).toBe("cas:2026-11");
  });
  it("uses the Indian calendar month for a CAS uploaded around midnight", () => {
    expect(
      updatesDue({
        ...base,
        today: "2026-12-05",
        hasFunds: true,
        lastCas: "2026-11-30T18:40:00Z",
      }),
    ).toEqual([]);
  });
  it("snoozes only that period and returns on the chosen day", () => {
    expect(
      updatesDue({
        ...base,
        hasFunds: true,
        snoozes: { "cas:2026-11": "2026-11-17" },
      }),
    ).toEqual([]);
    expect(
      updatesDue({
        ...base,
        today: "2026-11-17",
        hasFunds: true,
        snoozes: { "cas:2026-11": "2026-11-17" },
      }),
    ).toHaveLength(1);
    expect(
      updatesDue({
        ...base,
        today: "2026-12-05",
        hasFunds: true,
        snoozes: { "cas:2026-11": "2026-12-06" },
      }),
    ).toHaveLength(1);
  });
  it("keeps confirmed balances fixed across missed monthly updates, while retaining schedule estimates", () => {
    const input = {
      outstanding: 80000,
      ratePct: 9,
      emi: 5000,
      monthsLeft: null,
      asOf: "2026-10-01",
      emiDay: 10,
    };
    expect(loanState({ ...input, confirmed: true }, "2027-02-20").balance).toBe(
      80000,
    );
    expect(loanState(input, "2027-02-20").balance).toBeLessThan(80000);
    expect(
      loanState({ ...input, confirmed: true, outstanding: 0 }, base.today)
        .nextEmi,
    ).toBeNull();
  });
});
