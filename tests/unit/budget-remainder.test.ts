import { describe, expect, it } from "vitest";
import { assistedBudget, suggestRemainingAllocation } from "@/lib/budget-assist";
import { emptyBudgetSheet, sheetTotals, type BudgetSheetRow } from "@/lib/budget-sheet";
const row = (id: string, category: BudgetSheetRow["category"], value: number): BudgetSheetRow => ({ id, name: id, category, value, mode: "amount", loanId: null });
describe("remaining budget proposal", () => {
  it("redistributes a deleted cost using the existing mix without changing existing commitments", () => {
    const plan = { ...emptyBudgetSheet(100000), rows: [row("costs", "fixed", 50000), row("saving", "savings", 20000), row("investment", "investing", 10000), row("personal", "personal", 10000)] };
    const snapshot = structuredClone(plan);
    expect(suggestRemainingAllocation(plan)).toEqual({ savings: 5000, investing: 2500, personal: 2500 });
    const accepted = assistedBudget(plan, suggestRemainingAllocation(plan))!;
    expect(sheetTotals(accepted).remaining).toBe(0);
    expect(accepted.rows.slice(0, 4)).toEqual(plan.rows);
    expect(plan).toEqual(snapshot);
    expect(suggestRemainingAllocation(accepted)).toEqual({ savings: 0, investing: 0, personal: 0 });
  });
  it("uses a disclosed starter mix and allocates odd rupees exactly", () => {
    expect(suggestRemainingAllocation(emptyBudgetSheet(10001))).toEqual({ savings: 4001, investing: 4000, personal: 2000 });
    for (let amount = 1; amount < 100; amount++) {
      const plan = { ...emptyBudgetSheet(amount + 3), rows: [row("s", "savings", 1), row("i", "investing", 1), row("p", "personal", 1)] };
      expect(Object.values(suggestRemainingAllocation(plan)).reduce((a,b) => a+b,0)).toBe(amount);
    }
  });
  it("respects zero category shares and percentage-based rows", () => {
    const plan = { ...emptyBudgetSheet(100000), rows: [{ ...row("saving", "savings", 20), mode: "percent" as const }, row("investing", "investing", 20000)] };
    expect(suggestRemainingAllocation(plan)).toEqual({ savings: 30000, investing: 30000, personal: 0 });
  });
  it("never creates money when over budget and rejects edits above the remainder", () => {
    const over = { ...emptyBudgetSheet(100), rows: [row("cost", "fixed", 200)] };
    expect(suggestRemainingAllocation(over)).toEqual({ savings: 0, investing: 0, personal: 0 });
    expect(assistedBudget(emptyBudgetSheet(100), { savings: 101, investing: 0, personal: 0 })).toBeNull();
  });
});
