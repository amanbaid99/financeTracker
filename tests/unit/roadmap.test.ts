import { describe, expect, it } from "vitest";
import type { Loan } from "@/lib/loans";
import { roadmap } from "@/lib/roadmap";
import { trackGoal, type GoalInput } from "@/lib/tracker";

const TODAY = "2026-11-16";
const goal = (over: Partial<GoalInput> & { id: string }): GoalInput =>
  ({
    name: over.id,
    type: "custom",
    target: 300000,
    targetDate: "2028-12-01",
    inflationPct: 0,
    ...over,
  }) as GoalInput;
const loan: Loan = {
  id: "l1",
  name: "Car loan",
  type: "car",
  cardId: null,
  principal: null,
  takenOn: null,
  ratePct: 12,
  emi: 15000,
  monthsLeft: null,
  totalEmis: null,
  emiDay: 3,
  billDay: null,
  firstEmi: null,
  outstanding: 140000,
  asOf: "2026-11-03",
  foreclosurePct: 0,
  foreclosureGst: true,
  payments: [],
  goal: null,
};
const inv = (value: number, sip: number) => ({
  id: "i",
  kind: "mutual_fund",
  name: null,
  category: "liquid_fund",
  value,
  monthlySip: sip,
  returnPct: null,
});

describe("roadmap", () => {
  const goals = [
    trackGoal(goal({ id: "wedding" }), [], [], TODAY),
    trackGoal(
      goal({ id: "done", target: 1000 }),
      [inv(5000, 0)],
      [{ goalId: "done", investmentId: "i", percent: 100 }],
      TODAY,
    ),
    trackGoal(
      goal({ id: "ef", type: "emergency_fund", targetDate: null }),
      [],
      [],
      TODAY,
    ),
  ];

  it("lays out salary, loans and goals by date, with reached goals done", () => {
    const r = roadmap({
      today: TODAY,
      goals,
      loans: [loan],
      salary: { best: "2027-01-05", worst: "2027-01-31", covered: true },
    });
    expect(r.ahead.map((s) => s.key)).toEqual([
      "salary",
      "restart",
      "loan:l1",
      "goal:wedding",
    ]);
    expect(r.ahead[0].sub).toBe(
      "Between 5 Jan and 31 Jan. You're covered till then.",
    );
    expect(r.ahead[1].date).toBe("2027-02-01");
    expect(r.ahead[2].title).toBe("Car loan paid off");
    expect(r.ahead[3].status).toBe("hold");
    expect(r.done.map((s) => s.key)).toEqual(["goal:done"]);
    expect(r.undated.map((s) => s.key)).toEqual(["goal:ef"]);
  });

  it("shows goals that need money as needing you once the salary is in", () => {
    const r = roadmap({ today: TODAY, goals, loans: [] });
    expect(r.ahead.find((s) => s.key === "goal:wedding")!.status).toBe("needs");
    expect(r.ahead.find((s) => s.key === "salary")).toBeUndefined();
  });
});
