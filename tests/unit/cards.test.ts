import { describe, expect, it } from "vitest";
import {
  averageBill,
  headlineMilestone,
  milestoneState,
  nextUnpaid,
  periodBounds,
  type CardSpend,
  type Milestone,
} from "@/lib/cards";

const TODAY = "2026-10-25";
const m = (over: Partial<Milestone>): Milestone => ({
  id: "m",
  name: "Bonus points",
  target: 400_000,
  period: "card_year",
  deadline: null,
  reward: "10,000 points",
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});
const bill = (month: string, amount: number) => ({
  id: month,
  month,
  amount,
  dueDate: null,
  paid: true,
  note: null,
});
/** A card where `amount` was typed as unbilled spend today, with no bills. */
const spend = (amount: number, yearStart: string | null = null): CardSpend => ({
  yearStart,
  bills: [],
  unbilled: amount,
  unbilledAsOf: TODAY,
});

describe("card periods", () => {
  it("works out the current period", () => {
    expect(periodBounds("month", TODAY, null, null)).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(periodBounds("quarter", TODAY, null, null)).toEqual({
      start: "2026-10-01",
      end: "2026-12-31",
    });
    expect(periodBounds("calendar_year", TODAY, null, null)).toEqual({
      start: "2026-01-01",
      end: "2026-12-31",
    });
    // Card year from 12 March: we're in 12 Mar 2026 to 11 Mar 2027.
    expect(periodBounds("card_year", TODAY, "2023-03-12", null)).toEqual({
      start: "2026-03-12",
      end: "2027-03-11",
    });
    // Card year from 1 December: still in last year's.
    expect(periodBounds("card_year", TODAY, "2024-12-01", null)).toEqual({
      start: "2025-12-01",
      end: "2026-11-30",
    });
    expect(periodBounds("once", TODAY, null, "2026-12-15")).toEqual({
      start: null,
      end: "2026-12-15",
    });
  });
});

describe("milestone progress", () => {
  it("shows progress, what's left and the monthly pace", () => {
    const s = milestoneState(m({}), TODAY, spend(160_000, "2023-03-12"));
    expect(s.progress).toBeCloseTo(0.4);
    expect(s.remaining).toBe(240_000);
    expect(s.daysLeft).toBe(138); // 25 Oct to 11 Mar, inclusive
    expect(s.neededPerMonth).toBeGreaterThan(52_000);
    expect(s.neededPerMonth).toBeLessThan(54_000);
    expect(s.status).toBe("behind"); // 62% of the card year gone, 40% spent
    expect(milestoneState(m({}), TODAY, spend(300_000, "2023-03-12")).status).toBe("on_pace");
    expect(milestoneState(m({}), TODAY, spend(400_000, "2023-03-12"))).toMatchObject({
      status: "achieved",
      neededPerMonth: null,
    });
  });

  it("counts logged bills from the month the period starts", () => {
    // Card year from 12 March 2026: the February bill belongs to last year.
    const card: CardSpend = {
      yearStart: "2023-03-12",
      bills: [bill("2026-09-01", 50_000), bill("2026-03-01", 30_000), bill("2026-02-01", 99_000)],
      unbilled: 0,
      unbilledAsOf: null,
    };
    expect(milestoneState(m({}), TODAY, card)).toMatchObject({
      billed: 80_000,
      billCount: 2,
      spentNow: 80_000,
    });
  });

  it("adds spend since the last bill, until the next bill is logged", () => {
    const bills = [bill("2026-09-01", 50_000)];
    const card: CardSpend = { yearStart: null, bills, unbilled: 20_000, unbilledAsOf: "2026-10-20" };
    expect(milestoneState(m({}), TODAY, card)).toMatchObject({ billed: 50_000, unbilledNow: 20_000, spentNow: 70_000 });
    // The October bill now includes that spend.
    const later = { ...card, bills: [bill("2026-10-01", 25_000), ...bills] };
    expect(milestoneState(m({}), TODAY, later)).toMatchObject({ unbilledNow: 0, spentNow: 75_000 });
  });

  it("starts a new period from zero", () => {
    const card: CardSpend = {
      yearStart: null,
      bills: [bill("2026-09-01", 80_000)],
      unbilled: 5_000,
      unbilledAsOf: "2026-09-28",
    };
    expect(milestoneState(m({ period: "quarter", target: 100_000 }), TODAY, card)).toMatchObject({
      spentNow: 0,
      remaining: 100_000,
    });
  });

  it("handles one-off milestones with and without a date", () => {
    const due = milestoneState(m({ period: "once", deadline: "2026-12-15", target: 50_000 }), TODAY, spend(10_000));
    expect(due).toMatchObject({ daysLeft: 52, status: "no_end" });
    expect(milestoneState(m({ period: "once", deadline: "2026-10-01" }), TODAY).status).toBe("missed");
  });

  it("puts the soonest open milestone on the card's row", () => {
    const states = [
      milestoneState(m({ id: "year" }), TODAY, spend(100_000, "2023-03-12")),
      milestoneState(m({ id: "q", period: "quarter", target: 50_000 }), TODAY, spend(10_000)),
      milestoneState(m({ id: "done", period: "month", target: 10_000 }), TODAY, spend(20_000)),
    ];
    expect(headlineMilestone(states)?.id).toBe("q");
  });
});

describe("bills", () => {
  const bill = (
    month: string,
    amount: number,
    paid = false,
    dueDate: string | null = null,
  ) => ({
    id: month,
    month,
    amount,
    paid,
    dueDate,
    note: null,
  });
  it("averages the latest six bills", () => {
    const bills = [9, 8, 7, 6, 5, 4, 3].map((m) =>
      bill(`2026-0${m}-01`, m * 1000),
    );
    expect(averageBill(bills)).toBe(6500);
    expect(averageBill([])).toBeNull();
  });
  it("picks the unpaid bill due soonest", () => {
    const bills = [
      bill("2026-10-01", 5000, false, "2026-11-05"),
      bill("2026-09-01", 4000, false, "2026-10-05"),
      bill("2026-08-01", 3000, true, "2026-09-05"),
    ];
    expect(nextUnpaid(bills)?.month).toBe("2026-09-01");
    expect(nextUnpaid([bills[2]])).toBeNull();
  });
});
