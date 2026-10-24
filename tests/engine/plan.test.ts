import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/engine";
import { buildMoneyPlan } from "@/lib/engine/plan";
import type { FinanceData } from "@/lib/engine/types";
import { makeData, solidBasics, TODAY } from "./fixtures";

const plan = (d: FinanceData) => buildMoneyPlan(d, analyze(d, {}, TODAY));
const total = (p: ReturnType<typeof plan>) => Object.values(p.totals).reduce((s, x) => s + x, 0) + p.unassigned;

describe("money plan", () => {
  it("assigns every rupee once basics are done", () => {
    const d = solidBasics({
      goals: [
        { id: "r", name: "Retirement", type: "retirement", targetToday: 15_000_000, targetDate: "2056-10-24", priority: 2, inflationRate: null, savedAmount: 0 },
      ],
    });
    const p = plan(d);
    expect(p.income).toBe(100_000);
    expect(total(p)).toBe(100_000);
    expect(p.lines.find((l) => l.label === "Rent")?.amount).toBe(40_000);
    // Yearly health premium becomes a monthly set-aside.
    expect(p.lines.find((l) => l.group === "set_aside")?.where).toContain("savings account");
    const retirement = p.lines.find((l) => l.label === "Retirement");
    expect(retirement?.group).toBe("invest");
    expect(retirement?.where).toMatch(/Equity index fund/);
    expect(p.totals.wants).toBeGreaterThan(0);
  });

  it("sends new savings to the emergency fund while it's short, in liquid categories", () => {
    const d = solidBasics({
      holdings: [{ id: "h", kind: "savings", name: null, category: "savings_account", currentValue: 100_000, monthlySip: null }],
    });
    const p = plan(d);
    const ef = p.lines.find((l) => l.label === "Emergency fund");
    expect(ef?.amount).toBeGreaterThan(0);
    expect(ef?.where).toContain("liquid fund");
    expect(total(p)).toBe(100_000);
  });

  it("keeps existing SIPs and says which goal they serve", () => {
    const d = solidBasics({
      holdings: [
        { id: "h", kind: "savings", name: null, category: "savings_account", currentValue: 200_000, monthlySip: null },
        { id: "m", kind: "mutual_fund", name: "My index SIP", category: "equity_index", currentValue: 50_000, monthlySip: 10_000 },
      ],
      goals: [{ id: "g", name: "House", type: "house_down_payment", targetToday: 2_000_000, targetDate: "2032-01-01", priority: 1, inflationRate: null, savedAmount: 0 }],
      allocations: [{ goalId: "g", holdingId: "m", percent: 100 }],
    });
    const p = plan(d);
    const sip = p.lines.find((l) => l.label === "My index SIP");
    expect(sip).toMatchObject({ group: "invest", amount: 10_000, where: "Equity index fund", note: "For House" });
    expect(total(p)).toBe(100_000);
  });

  it("puts new savings on the highest-rate debt", () => {
    const d = solidBasics({
      liabilities: [{ id: "cc", kind: "credit_card", label: "Card", outstanding: 60_000, interestRate: 40, emi: 0 }],
    });
    const p = plan(d);
    expect(p.lines.find((l) => l.group === "debt")?.label).toContain("Card");
  });

  it("with a ₹0 salary shows runway instead of a savings plan", () => {
    const d = makeData({
      incomes: [{ id: "i", label: "Salary", type: "stable_salary", amountMonthly: 0 }],
      holdings: [{ id: "h", kind: "savings", name: null, category: "savings_account", currentValue: 120_000, monthlySip: null }],
    });
    const a = analyze(d, {}, TODAY);
    expect(a.noIncome).toBe(true);
    expect(a.runway.months).toBe(3);
    expect(a.nextFocus?.title).toBe("You're between incomes");
    expect(a.nextFocus?.runwayMonths).toBe(3);
    const p = buildMoneyPlan(d, a);
    expect(p.noIncome).toBe(true);
    expect(p.totals.invest).toBe(0);
    expect(p.notes[0]).toContain("about 3 months");
  });

  it("switches back to the normal plan when salary is added", () => {
    const d = makeData({
      holdings: [{ id: "h", kind: "savings", name: null, category: "savings_account", currentValue: 120_000, monthlySip: null }],
    });
    const a = analyze(d, {}, TODAY);
    expect(a.noIncome).toBe(false);
    expect(a.nextFocus?.title).not.toBe("You're between incomes");
  });
});
