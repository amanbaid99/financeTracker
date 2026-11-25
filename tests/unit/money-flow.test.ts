import { describe, expect, it } from "vitest";
import type { BudgetSheet } from "@/lib/budget-sheet";
import { moneyFlow } from "@/lib/money-flow";

const G1 = "00000000-0000-4000-8000-000000000001";
const sheet = (sips: number[] = [], extra: Partial<BudgetSheet> = {}) =>
  ({
    version: 2,
    salary: 100000,
    rows: [
      {
        id: "s",
        name: "Save & invest",
        category: "investing",
        mode: "amount",
        value: 40000,
      },
    ],
    excludedLoanIds: [],
    sips: sips.map((amount, i) => ({
      id: `r${i}`,
      investmentId: null,
      label: "Goal",
      amount,
      goalId: G1,
    })),
    ...extra,
  }) as unknown as BudgetSheet;

describe("moneyFlow", () => {
  it("shows saving from the budget and investing from Your SIPs", () => {
    const f = moneyFlow(sheet([12000, 8000]), true, 3000);
    expect(f.saving).toBe(40000);
    expect(f.savingRate).toBe(40);
    expect(f.investing).toBe(20000);
    expect(f.notInvested).toBe(20000);
  });

  it("falls back to SIPs on holdings when none are set on Budget", () => {
    expect(moneyFlow(sheet(), true, 3000).investing).toBe(3000);
  });

  it("has no saving without a saved budget or a salary", () => {
    const none = moneyFlow(null, false, 5000);
    expect(none.saving).toBeNull();
    expect(none.notInvested).toBeNull();
    expect(none.investing).toBe(5000);
    expect(moneyFlow(sheet([], { noSalary: true }), true, 0).saving).toBeNull();
  });
});
