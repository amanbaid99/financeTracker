import { describe, expect, it } from "vitest";
import { buildAskContext, restoreNames, rough } from "@/lib/ask/context";
import { trackGoal, type GoalInput, type Investment, type Link } from "@/lib/tracker";

const TODAY = "2026-10-25";
const investments: Investment[] = [
  { id: "a", kind: "mutual_fund", name: "Riya's index SIP", category: "equity_index", value: 412_345, monthlySip: 10_000, returnPct: null, invested: 300_000 },
  { id: "b", kind: "savings", name: "Kotak salary account", category: "savings_account", value: 92_150, monthlySip: 0, returnPct: null },
];
const links: Link[] = [{ goalId: "g1", investmentId: "a", percent: 60 }];
const goals: GoalInput[] = [
  { id: "g1", name: "Riya's wedding", type: "wedding", target: 2_000_000, targetDate: "2030-02-01", inflationPct: null },
  {
    id: "g2", name: "Bills", type: "bills_fund", target: 0, targetDate: null, inflationPct: null,
    bills: [{ name: "Dad's health insurance", amount: 24_000, everyMonths: 12, nextDue: "2027-02-10" }],
  },
];

function ctx() {
  return buildAskContext({
    goals: goals.map((g) => trackGoal(g, investments, links, TODAY)),
    investments,
    links,
    plan: { lump: 50_000, monthly: 30_000 },
    todayISO: TODAY,
  });
}

describe("Ask context", () => {
  it("rounds amounts", () => {
    expect(rough(412_345)).toBe("₹4,12,000");
    expect(rough(4_349)).toBe("₹4,300");
  });

  it("uses codes, never the names you typed", () => {
    const { facts, names } = ctx();
    for (const secret of ["Riya", "Kotak", "Dad", "wedding\"", "412,345", "4,12,345"]) expect(facts).not.toContain(secret);
    expect(facts).toContain("[G1] wedding goal");
    expect(facts).toContain("[I1] Equity index fund");
    expect(facts).toContain("counts toward [G1] (60%)");
    expect(facts).toContain("[I2] Savings account");
    expect(facts).toContain("not linked to any goal");
    expect(facts).toMatch(/planned payment \[B1\] ₹24,000 due Feb 2027/);
    expect(facts).toContain("Money plan: ₹50,000 available");
    expect(names).toMatchObject({ "[G1]": "Riya's wedding", "[I2]": "Kotak salary account", "[B1]": "Dad's health insurance" });
  });

  it("turns codes in the reply back into your names", () => {
    const { names } = ctx();
    expect(restoreNames("Take it from [I2], not [G1]. [I9] is unknown.", names)).toBe(
      "Take it from “Kotak salary account”, not “Riya's wedding”. [I9] is unknown.",
    );
  });
});
