import { describe, expect, it } from "vitest";
import { adviseCards } from "@/lib/card-advisor";
import type { Card } from "@/lib/cards";

const TODAY = "2026-10-26";
const bills = (amounts: number[]) =>
  amounts.map((amount, i) => ({
    id: `b${i}`,
    month: `2026-${String(9 - i).padStart(2, "0")}-01`,
    amount,
    dueDate: null,
    paid: true,
    note: null,
  }));
const ms = (id: string, target: number, reward: string) => ({
  id,
  name: reward,
  target,
  period: "card_year" as const,
  deadline: null,
  reward,
  createdAt: "2026-01-01T00:00:00Z",
});

// The real HSBC TravelOne and SBI PhonePe numbers, newest bill first.
const hsbc: Card = {
  id: "hsbc",
  label: "HSBC TravelOne",
  annualFee: 4999,
  yearStart: "2026-01-01",
  rewards: null,
  benefits: [],
  bestFor: ["travel", "international"],
  milestones: [ms("h1", 800000, "Annual fee waived"), ms("h2", 1200000, "10000 bonus points")],
  // Spend now comes from the bills themselves.
  bills: bills([56053, 45856, 68589, 26843, 35872, 74100, 6364, 40333, 7300]),
  unbilled: 0,
  unbilledAsOf: null,
};
const sbi: Card = {
  id: "sbi",
  label: "SBI PhonePe",
  annualFee: 1499,
  yearStart: "2026-03-01",
  rewards: null,
  benefits: [],
  bestFor: ["upi", "bills"],
  milestones: [ms("s1", 300000, "Annual fee waived"), ms("s2", 500000, "5000 voucher")],
  bills: bills([48834, 32874, 20722, 35746, 65323, 35872, 10904]),
  unbilled: 0,
  unbilledAsOf: null,
};

describe("adviseCards", () => {
  const a = adviseCards([hsbc, sbi], TODAY);

  it("uses the usual monthly spend across cards", () => {
    expect(a.capacity).toBe(51219 + 39895);
  });

  it("flags the HSBC fee waiver as out of reach before 31 Dec", () => {
    const fee = a.plan.find((p) => p.milestone.id === "h1")!;
    expect(fee.status).toBe("unlikely");
    expect(fee.perMonth).toBeGreaterThan(150000);
  });

  it("chases both SBI milestones and picks SBI", () => {
    expect(a.plan.filter((p) => p.cardId === "sbi").map((p) => p.status)).toEqual(["chase", "chase"]);
    expect(a.pick?.cardLabel).toBe("SBI PhonePe");
    expect(a.pick?.reason).toBe("₹2,49,725 more by 28 Feb 2027 gets Annual fee waived and 5000 voucher.");
  });

  it("charges each later milestone only the extra it needs", () => {
    const [s1, s2] = a.plan.filter((p) => p.cardId === "sbi");
    expect(s1.perMonth + s2.perMonth).toBeLessThan(65000);
    expect(a.spare).toBeGreaterThan(0);
  });

  it("lists cards that suit a category", () => {
    expect(adviseCards([hsbc, sbi], TODAY, "travel").forCategory.map((c) => c.cardId)).toEqual(["hsbc"]);
  });

  it("with no bills, nothing is chased and no amount is guessed", () => {
    const none = adviseCards([{ ...sbi, bills: [], unbilled: 250275, unbilledAsOf: TODAY }], TODAY);
    expect(none.capacity).toBeNull();
    expect(none.plan.every((p) => p.status === "unlikely")).toBe(true);
  });
});
