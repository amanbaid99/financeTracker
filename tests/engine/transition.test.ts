import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/engine";
import { buildTransitionPlan } from "@/lib/engine/transition";
import type { Holding } from "@/lib/engine/types";
import { makeData, TODAY } from "./fixtures";

const h = (over: Partial<Holding> & { id: string }): Holding => ({
  kind: "savings",
  name: null,
  category: "savings_account",
  currentValue: 0,
  monthlySip: null,
  ...over,
});

describe("between-incomes plan", () => {
  it("suggests liquid money when nothing is picked", () => {
    const d = makeData({
      holdings: [
        h({ id: "bank", name: "Main", currentValue: 120_000 }),
        h({ id: "eq", kind: "mutual_fund", category: "equity_index", currentValue: 500_000 }),
      ],
    });
    const p = buildTransitionPlan(d, 40_000, TODAY);
    expect(p.chosen).toBe(false);
    expect(p.funds.map((f) => f.id)).toEqual(["bank"]);
    expect(p.months).toBe(3);
    expect(p.runsOutOn).toBe("2027-01-24");
  });

  it("uses picked holdings in order: bank, liquid, FD, then market funds, with goal money last", () => {
    const d = makeData({
      holdings: [
        h({ id: "eq", kind: "mutual_fund", category: "flexi_cap", currentValue: 100_000, transitionFund: true }),
        h({ id: "fd", kind: "fd", category: "fd_rd", currentValue: 100_000, transitionFund: true }),
        h({ id: "liq", kind: "mutual_fund", category: "liquid_fund", currentValue: 100_000, transitionFund: true }),
        h({ id: "bank", currentValue: 50_000, transitionFund: true }),
        h({ id: "arb", kind: "mutual_fund", category: "arbitrage", currentValue: 50_000, transitionFund: true }),
        h({ id: "arb2", kind: "mutual_fund", category: "arbitrage", currentValue: 80_000, transitionFund: true }),
        h({ id: "ppf", kind: "ppf", category: "ppf", currentValue: 900_000, transitionFund: true }),
      ],
      goals: [{ id: "g", name: "Bike", type: "vehicle", targetToday: 100_000, targetDate: null, priority: 1, inflationRate: null, savedAmount: 0 }],
      allocations: [{ goalId: "g", holdingId: "arb2", percent: 100 }],
    });
    const p = buildTransitionPlan(d, 50_000, TODAY);
    expect(p.chosen).toBe(true);
    expect(p.funds.map((f) => f.id)).toEqual(["bank", "liq", "fd", "arb", "arb2", "eq"]);
    expect(p.total).toBe(480_000);
    expect(p.months).toBe(9.6);
    expect(p.funds[0]).toMatchObject({ fromMonth: 0, toMonth: 1 });
    expect(p.thisMonth).toEqual([{ label: "Savings account", amount: 50_000 }]);
    expect(p.candidates.some((c) => c.id === "ppf")).toBe(false);
  });

  it("pays card bills first and shows the effect of pausing SIPs", () => {
    const d = makeData({
      holdings: [
        h({ id: "bank", name: "Main", currentValue: 300_000, transitionFund: true }),
        h({ id: "sip", kind: "mutual_fund", category: "equity_index", currentValue: 10_000, monthlySip: 10_000 }),
      ],
      cards: [{ id: "c", label: "Card", outstanding: 20_000, dueDay: 5 }],
    });
    const p = buildTransitionPlan(d, 40_000, TODAY);
    expect(p.months).toBe(7);
    expect(p.monthsWithSips).toBe(5.6);
    expect(p.thisMonth).toEqual([{ label: "Main", amount: 40_000 }]);
    expect(p.notes.join(" ")).toMatch(/Pausing SIPs/);
  });

  it("only appears with no income, and drives the runway", () => {
    const holdings = [h({ id: "bank", currentValue: 200_000, transitionFund: true })];
    const working = analyze(makeData({ holdings }), {}, TODAY);
    expect(working.transition).toBeNull();
    const between = analyze(
      makeData({
        holdings,
        incomes: [{ id: "i1", label: "Salary", type: "stable_salary", amountMonthly: 0 }],
        expenses: [{ id: "e", category: "Rent", amountMonthly: 50_000, isEssential: true }],
      }),
      {},
      TODAY,
    );
    expect(between.transition?.months).toBe(4);
    expect(between.runway.months).toBe(4);
  });
});
