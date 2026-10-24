import { describe, expect, it } from "vitest";
import { budgetStream, computeBudget, splitBase } from "@/lib/engine/budget";
import { defaultConfig, mergeConfig } from "@/lib/engine/config";
import { makeData, TODAY } from "./fixtures";

const cfg = mergeConfig();

describe("income types", () => {
  it("stable salary: the whole amount is base", () => {
    const s = budgetStream({ id: "a", label: "Job", type: "stable_salary", amountMonthly: 100_000 }, cfg, false);
    expect(s.base).toBe(100_000);
    expect(s.surplus).toBe(0);
  });

  it("variable salary with a fixed part: fixed is base, rest is split 50/30/20", () => {
    const s = budgetStream(
      {
        id: "a",
        label: "Sales job",
        type: "variable_salary",
        amountMonthly: 70_000,
        fixedMonthly: 50_000,
        history: [80_000, 60_000, 70_000],
      },
      cfg,
      false,
    );
    expect(s.base).toBe(50_000);
    expect(s.expectedMonthly).toBe(70_000);
    expect(s.surplus).toBe(20_000);
    expect(s.split).toEqual({ ladder: 10_000, goals: 6_000, wants: 4_000 });
  });

  it("variable salary with no fixed part: lowest of recent months is base", () => {
    const s = budgetStream(
      { id: "a", label: "Commission", type: "variable_salary", amountMonthly: 0, history: [80_000, 60_000, 70_000] },
      cfg,
      false,
    );
    expect(s.base).toBe(60_000);
    expect(s.surplus).toBe(10_000);
    expect(s.split).toEqual({ ladder: 5_000, goals: 3_000, wants: 2_000 });
  });

  it("multiple jobs: secondary income is never base and splits 70/30", () => {
    const data = makeData({
      incomes: [
        { id: "j1", label: "Main job", type: "stable_salary", amountMonthly: 100_000, isPrimary: true },
        { id: "j2", label: "Weekend job", type: "stable_salary", amountMonthly: 30_000 },
      ],
    });
    const b = computeBudget(data, cfg, { todayISO: TODAY });
    expect(b.baseIncome).toBe(100_000);
    const second = b.streams.find((s) => s.id === "j2")!;
    expect(second.role).toBe("secondary_job");
    expect(second.base).toBe(0);
    expect(second.split).toEqual({ ladder: 10_500, goals: 10_500, wants: 9_000 });
    expect(b.expectedIncome).toBe(130_000);
  });

  it("multiple jobs without a flag: the larger salary is primary", () => {
    const data = makeData({
      incomes: [
        { id: "j1", label: "Small", type: "stable_salary", amountMonthly: 20_000 },
        { id: "j2", label: "Big", type: "stable_salary", amountMonthly: 90_000 },
      ],
    });
    const b = computeBudget(data, cfg, { todayISO: TODAY });
    expect(b.baseIncome).toBe(90_000);
  });

  it("freelance: tax reserve first, pay-yourself is the average of the lowest 3 of 6 months", () => {
    const s = budgetStream(
      {
        id: "f",
        label: "Design work",
        type: "freelance",
        amountMonthly: 0,
        history: [100_000, 50_000, 80_000, 120_000, 60_000, 90_000],
      },
      cfg,
      false,
    );
    // Net of 25% tax: 75k, 37.5k, 60k, 90k, 45k, 67.5k. Lowest 3 average = 47.5k.
    expect(s.base).toBe(47_500);
    expect(s.expectedMonthly).toBe(62_500);
    expect(s.surplus).toBe(15_000);
    expect(s.taxReserve).toBe(20_833);
    expect(s.split).toEqual({ ladder: 7_500, goals: 4_500, wants: 3_000 });
  });

  it("business follows the freelance rule and gets advance tax dates", () => {
    const data = makeData({
      incomes: [{ id: "b", label: "Shop", type: "business", amountMonthly: 80_000 }],
    });
    const b = computeBudget(data, cfg, { todayISO: TODAY });
    expect(b.baseIncome).toBe(60_000);
    expect(b.freelancer?.taxReserveMonthly).toBe(20_000);
    expect(b.freelancer?.bufferTarget).toBe(180_000);
    expect(b.freelancer?.nextAdvanceTaxDate).toBe("2026-12-15");
  });

  it("bonus: one-off, not base, split 50/30/20", () => {
    const data = makeData({
      incomes: [
        { id: "s", label: "Salary", type: "stable_salary", amountMonthly: 100_000 },
        { id: "b", label: "Diwali bonus", type: "bonus", amountMonthly: 200_000 },
      ],
    });
    const b = computeBudget(data, cfg, { todayISO: TODAY });
    expect(b.baseIncome).toBe(100_000);
    expect(b.expectedIncome).toBe(100_000);
    expect(b.oneOff).toEqual({ total: 200_000, ladder: 100_000, goals: 60_000, wants: 40_000 });
  });

  it("rental and other income count fully as base", () => {
    const data = makeData({
      incomes: [
        { id: "r", label: "Flat rent", type: "rental", amountMonthly: 20_000 },
        { id: "o", label: "Interest", type: "other", amountMonthly: 5_000 },
      ],
    });
    expect(computeBudget(data, cfg, { todayISO: TODAY }).baseIncome).toBe(25_000);
  });

  it("inactive streams are ignored and gross amounts get a note", () => {
    const data = makeData({
      incomes: [
        { id: "s", label: "Salary", type: "stable_salary", amountMonthly: 100_000, isGross: true },
        { id: "x", label: "Old job", type: "stable_salary", amountMonthly: 50_000, active: false },
      ],
    });
    const b = computeBudget(data, cfg, { todayISO: TODAY });
    expect(b.baseIncome).toBe(100_000);
    expect(b.notes.some((n) => n.includes("before tax"))).toBe(true);
  });
});

describe("monthly split of base income", () => {
  it("savings default to 20% of base", () => {
    expect(splitBase(100_000, 41_000, 0, cfg)).toMatchObject({ savings: 20_000, wants: 39_000 });
  });

  it("savings rise to what the step needs, capped at 90% with essentials", () => {
    expect(splitBase(100_000, 41_000, 60_000, cfg)).toMatchObject({ savings: 49_000, wants: 10_000 });
  });

  it("savings never go negative when essentials are above 90%", () => {
    expect(splitBase(100_000, 95_000, 0, cfg)).toMatchObject({ savings: 0, wants: 5_000 });
  });

  it("essentials above base give a shortfall", () => {
    expect(splitBase(100_000, 120_000, 0, cfg)).toMatchObject({ savings: 0, wants: 0, shortfall: 20_000 });
  });

  it("essentials include EMIs and non-employer premiums", () => {
    const data = makeData({
      liabilities: [{ id: "l", kind: "car", outstanding: 300_000, interestRate: 9, emi: 10_000 }],
      insurance: [
        { id: "p", kind: "health", source: "personal", coverAmount: 1_000_000, premium: 24_000, renewalMonth: 1 },
        { id: "q", kind: "health", source: "employer", coverAmount: 500_000, premium: 12_000, renewalMonth: 1 },
      ],
    });
    const b = computeBudget(data, cfg, { todayISO: TODAY });
    expect(b.essentials).toMatchObject({ expenses: 40_000, emis: 10_000, insurancePremiums: 2_000, total: 52_000 });
  });

  it("falls back to 50% of base when expenses are not entered", () => {
    const data = makeData({ expenses: [] });
    data.profile.answered = data.profile.answered.filter((s) => s !== "expenses");
    const b = computeBudget(data, cfg, { todayISO: TODAY });
    expect(b.essentials.estimated).toBe(true);
    expect(b.essentials.expenses).toBe(50_000);
  });

  it("uses user overrides for percentages", () => {
    const c = mergeConfig({ budget: { savingsMinPct: 0.3 } });
    expect(splitBase(100_000, 40_000, 0, c).savings).toBe(30_000);
    expect(defaultConfig.budget.savingsMinPct).toBe(0.2);
  });

  it("ignores overrides of the wrong type", () => {
    const c = mergeConfig({ budget: { savingsMinPct: "lots" } });
    expect(c.budget.savingsMinPct).toBe(0.2);
  });
});
