import { describe, expect, it } from "vitest";
import { budget, rateNote } from "@/lib/budget";

const inc = (amount: number, active = true) => ({ id: "i", label: "Salary", type: "stable_salary", amount, active });
const cost = (name: string, amount: number) => ({ id: name, name, amount });

describe("budget", () => {
  it("works out what's free to invest after costs, EMIs and SIPs", () => {
    const b = budget({
      incomes: [inc(120000), inc(30000, false)],
      costs: [cost("Rent", 25000), cost("Day-to-day spending", 20000)],
      emis: 28726,
      sips: 20000,
    });
    expect(b.income).toBe(120000);
    expect(b.free).toBe(120000 - 45000 - 28726 - 20000);
    expect(b.planMonthly).toBe(20000 + b.free);
    expect(b.rateNow).toBeCloseTo(20000 / 120000);
    expect(b.rateWithPlan).toBeCloseTo((20000 + b.free) / 120000);
  });

  it("doesn't plan to invest money that isn't there", () => {
    const b = budget({ incomes: [inc(50000)], costs: [cost("Rent", 40000)], emis: 15000, sips: 5000 });
    expect(b.free).toBe(-10000);
    expect(b.planMonthly).toBe(5000);
  });

  it("explains the savings rate against the 20% guide", () => {
    expect(rateNote(0.25).tone).toBe("good");
    expect(rateNote(0.12).tone).toBe("ok");
    expect(rateNote(0.05).tone).toBe("low");
  });
});
