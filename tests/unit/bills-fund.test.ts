import { describe, expect, it } from "vitest";
import { planMoney } from "@/lib/allocate";
import { billsFundState, rollForward, type Bill } from "@/lib/bills-fund";
import { goalHeadline } from "@/lib/goal-summary";
import { trackGoal, type GoalInput, type Investment } from "@/lib/tracker";

const TODAY = "2026-10-25";
const bills: Bill[] = [
  { name: "Health insurance", amount: 24_000, everyMonths: 12, nextDue: "2026-03-15" }, // already paid; rolls to 2027
  { name: "Gym", amount: 12_000, everyMonths: 6, nextDue: "2026-12-01" },
  { name: "Bike service", amount: 4_000, everyMonths: 12, nextDue: "2027-08-10" },
];

describe("bills fund", () => {
  it("rolls past due dates forward", () => {
    expect(rollForward("2026-03-15", 12, TODAY)).toBe("2027-03-15");
    expect(rollForward("2026-10-25", 1, TODAY)).toBe("2026-10-25");
    expect(rollForward("2026-09-01", 1, TODAY)).toBe("2026-11-01");
  });

  it("works out the monthly amount and what the fund should hold", () => {
    const s = billsFundState(bills, 0, 0, TODAY);
    expect(s.monthlyNeed).toBe(4_334); // 2,000 + 2,000 + 333.33
    // Health 8 of 12 months built up, gym 5 of 6, bike 3 of 12.
    expect(s.shouldHold).toBe(16_000 + 10_000 + 1_000);
    expect(s.bills[0]).toMatchObject({ name: "Gym", due: "2026-12-01" });
    expect(s.upcoming.map((e) => e.name)).toEqual(["Gym", "Health insurance", "Gym", "Bike service"]);
  });

  it("finds the first payment it can't cover, and the top-up that fixes it", () => {
    const empty = billsFundState(bills, 0, 0, TODAY);
    expect(empty.firstShort).toMatchObject({ name: "Gym", date: "2026-12-01", shortBy: 12_000 });
    expect(empty.topUpNow).toBeGreaterThan(0);
    const fixed = billsFundState(bills, empty.topUpNow, empty.monthlyNeed, TODAY);
    expect(fixed.firstShort).toBeNull();
    expect(fixed.upcoming.every((e) => e.covered)).toBe(true);
  });

  const goal: GoalInput = { id: "b", name: "Bills fund", type: "bills_fund", target: 0, targetDate: null, inflationPct: null, bills };
  const fund = (value: number, sip: number): Investment => ({
    id: "f", kind: "mutual_fund", name: null, category: "liquid_fund", value, monthlySip: sip, returnPct: null,
  });

  it("tracks as a goal with a plain status line", () => {
    const ok = trackGoal(goal, [fund(30_000, 5_000)], [{ goalId: "b", investmentId: "f", percent: 100 }], TODAY);
    expect(ok.status).toBe("on_track");
    expect(ok.futureTarget).toBe(27_000);
    expect(goalHeadline(ok).text).toBe("Next: Gym on 1 Dec, covered");
    const short = trackGoal(goal, [fund(2_000, 1_000)], [{ goalId: "b", investmentId: "f", percent: 100 }], TODAY);
    expect(short.status).toBe("behind");
    expect(short.extraSipNeeded).toBe(3_334);
    expect(goalHeadline(short).text).toMatch(/short for Gym on 1 Dec$/);
  });

  it("comes first in the money plan, in a liquid fund", () => {
    const g = trackGoal(goal, [], [], TODAY);
    const p = planMoney({ goals: [g], investments: [], links: [], lump: 50_000, monthlyTotal: 10_000, todayISO: TODAY });
    const s = p.suggestions[0];
    expect(s.category).toBe("liquid_fund");
    expect(s.monthly).toBe(4_500);
    expect(s.lump).toBeGreaterThan(0);
    expect(s.after.status).toBe("on_track");
  });
});
