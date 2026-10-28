import { describe, expect, it } from "vitest";
import { planMoney } from "@/lib/allocate";
import { billsFundState, rollForward, type Bill } from "@/lib/bills-fund";
import { goalHeadline } from "@/lib/goal-summary";
import { trackGoal, type GoalInput, type Investment } from "@/lib/tracker";

const TODAY = "2026-10-25";
const bills: Bill[] = [
  {
    name: "Health insurance",
    amount: 24_000,
    everyMonths: 12,
    nextDue: "2026-03-15",
  }, // already paid; rolls to 2027
  { name: "Gym", amount: 12_000, everyMonths: 6, nextDue: "2026-12-01" },
  {
    name: "Bike service",
    amount: 4_000,
    everyMonths: 12,
    nextDue: "2027-08-10",
  },
];

describe("bills fund", () => {
  it("rolls past due dates forward", () => {
    expect(rollForward("2026-03-15", 12, TODAY)).toBe("2027-03-15");
    expect(rollForward("2026-10-25", 1, TODAY)).toBe("2026-10-25");
    expect(rollForward("2026-09-01", 1, TODAY)).toBe("2026-11-01");
  });

  it("works out the monthly amount and what the fund should hold", () => {
    const s = billsFundState(bills, 0, 0, TODAY);
    // From an empty fund the steady 4,334 (2,000 + 2,000 + 333.33) would
    // leave the gym short on 1 Dec; 7,200 a month covers every payment.
    expect(s.monthlyNeed).toBe(7_200);
    expect(billsFundState(bills, 0, 7_200, TODAY).short).toBeNull();
    expect(billsFundState(bills, 0, 7_199, TODAY).short).not.toBeNull();
    // With money already in the fund it never asks for less than the steady amount.
    expect(billsFundState(bills, 60_000, 0, TODAY).monthlyNeed).toBe(4_334);
    // Health 8 of 12 months built up, gym 5 of 6, bike 3 of 12.
    expect(s.shouldHold).toBe(16_000 + 10_000 + 1_000);
    expect(s.bills[0]).toMatchObject({ name: "Gym", due: "2026-12-01" });
    expect(s.upcoming.map((e) => e.name)).toEqual([
      "Gym",
      "Health insurance",
      "Gym",
      "Bike service",
    ]);
  });

  it("finds the first payment it can't cover, and the top-up that fixes it", () => {
    const empty = billsFundState(bills, 0, 0, TODAY);
    expect(empty.firstShort).toMatchObject({
      name: "Gym",
      date: "2026-12-01",
      shortBy: 12_000,
    });
    expect(empty.topUpNow).toBeGreaterThan(0);
    const fixed = billsFundState(
      bills,
      empty.topUpNow,
      empty.monthlyNeed,
      TODAY,
    );
    expect(fixed.firstShort).toBeNull();
    expect(fixed.upcoming.every((e) => e.covered)).toBe(true);
  });

  const goal: GoalInput = {
    id: "b",
    name: "Bills fund",
    type: "bills_fund",
    target: 0,
    targetDate: null,
    inflationPct: null,
    bills,
  };
  const fund = (value: number, sip: number): Investment => ({
    id: "f",
    kind: "mutual_fund",
    name: null,
    category: "liquid_fund",
    value,
    monthlySip: sip,
    returnPct: null,
  });

  it("tracks as a goal with a plain status line", () => {
    const ok = trackGoal(
      goal,
      [fund(30_000, 5_000)],
      [{ goalId: "b", investmentId: "f", percent: 100 }],
      TODAY,
    );
    expect(ok.status).toBe("on_track");
    expect(ok.futureTarget).toBe(27_000);
    expect(goalHeadline(ok).text).toBe("Next: Gym on 1 Dec, covered");
    const short = trackGoal(
      goal,
      [fund(2_000, 1_000)],
      [{ goalId: "b", investmentId: "f", percent: 100 }],
      TODAY,
    );
    expect(short.status).toBe("behind");
    expect(short.extraSipNeeded).toBe(short.billsFund!.monthlyNeed - 1_000);
    expect(goalHeadline(short).text).toBe(
      `Needs ₹${short.extraSipNeeded.toLocaleString("en-IN")} more a month`,
    );
  });

  it("comes first in the money plan, in a liquid fund", () => {
    const g = trackGoal(goal, [], [], TODAY);
    const p = planMoney({
      goals: [g],
      investments: [],
      links: [],
      lump: 50_000,
      monthlyTotal: 10_000,
      todayISO: TODAY,
    });
    const s = p.suggestions[0];
    expect(s.category).toBe("liquid_fund");
    expect(s.monthly).toBe(4_500);
    expect(s.lump).toBeGreaterThan(0);
    expect(s.after.status).toBe("on_track");
  });
});

describe("one-time payments", () => {
  const once = (name: string, amount: number, nextDue: string): Bill => ({
    name,
    amount,
    everyMonths: 0,
    nextDue,
  });
  const yearly = (name: string, amount: number, nextDue: string): Bill => ({
    name,
    amount,
    everyMonths: 12,
    nextDue,
  });
  // A real list: three months of expenses and EMIs paid once each, a
  // settlement, and yearly insurance.
  const real: Bill[] = [
    once("Nov expenses", 25_000, "2026-11-01"),
    once("IDFC emi 1", 13_711, "2026-11-03"),
    once("HDFC emi 1", 15_015, "2026-11-15"),
    once("Dec expenses", 25_000, "2026-12-01"),
    once("IDFC emi 2", 13_711, "2026-12-03"),
    once("HDFC emi 2", 15_015, "2026-12-15"),
    once("Fnf", 30_000, "2027-01-01"),
    once("Jan expenses", 25_000, "2027-01-01"),
    once("IDFC emi 3", 13_711, "2027-01-03"),
    once("HDFC emi 3", 15_015, "2027-01-15"),
    yearly("My Health insurance", 15_000, "2027-02-01"),
    yearly("Gym", 20_000, "2027-03-01"),
    yearly("Moms health insurance", 25_000, "2027-03-01"),
    yearly("Dads health insurance", 20_000, "2027-09-01"),
    yearly("My Term insurance", 30_000, "2027-10-01"),
  ];

  it("counts each once, so the balance covers everything with nothing going in", () => {
    const s = billsFundState(real, 380_278, 0, "2026-10-27");
    expect(s.firstShort).toBeNull();
    expect(s.upcoming.filter((e) => e.name === "Nov expenses")).toHaveLength(1);
    expect(s.upcoming.every((e) => e.covered)).toBe(true);
  });

  it("the same list as monthly payments runs short, which is what went wrong", () => {
    const monthly = real.map((b) =>
      b.everyMonths === 0 ? { ...b, everyMonths: 1 } : b,
    );
    expect(
      billsFundState(monthly, 380_278, 0, "2026-10-27").firstShort,
    ).not.toBeNull();
  });

  it("drops a one-time payment once its date has passed", () => {
    const s = billsFundState(
      [once("Laptop", 60_000, "2026-09-01")],
      0,
      0,
      TODAY,
    );
    expect(s.bills).toHaveLength(0);
    expect(s.upcoming).toHaveLength(0);
    expect(s.monthlyNeed).toBe(0);
    expect(rollForward("2026-09-01", 0, TODAY)).toBe("2026-09-01");
  });

  it("asks to save a near one-off over the months left", () => {
    const s = billsFundState(
      [once("Wedding gift", 30_000, "2027-01-25")],
      0,
      0,
      TODAY,
    );
    expect(s.monthlyNeed).toBe(10_000); // 3 months to go
  });
});
