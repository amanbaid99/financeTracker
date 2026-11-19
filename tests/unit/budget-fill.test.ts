import { describe, expect, it } from "vitest";
import { fillFromRecords } from "@/lib/budget-assist";
import { addScheduledEmis, emptyBudgetSheet } from "@/lib/budget-sheet";

const loan = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Car loan",
  emi: 14500,
};
const costs = [
  { id: "a", name: "Rent", amount: 30000 },
  { id: "b", name: "Day-to-day spending", amount: 20000 },
  { id: "c", name: "Groceries", amount: 10000 },
];

describe("fillFromRecords", () => {
  it("starts a new budget from recorded costs, EMIs and SIPs, once", () => {
    const start = addScheduledEmis(emptyBudgetSheet(150000), [loan]);
    const plan = fillFromRecords(start, costs, [loan], 5000);
    expect(plan.rows.map((r) => [r.name, r.category, r.value])).toEqual([
      ["Car loan EMI", "fixed", 14500],
      ["Rent", "fixed", 30000],
      ["Day-to-day spending", "variable", 20000],
      ["Groceries", "variable", 10000],
      ["Existing monthly SIPs", "investing", 5000],
    ]);
    // Filling again adds nothing new.
    expect(fillFromRecords(plan, costs, [loan], 5000).rows).toEqual(plan.rows);
  });

  it("doesn't add a recorded EMI cost on top of a tracked loan", () => {
    const start = addScheduledEmis(emptyBudgetSheet(100000), [loan]);
    const plan = fillFromRecords(
      start,
      [{ id: "e", name: "Car EMI", amount: 14500 }],
      [loan],
    );
    expect(plan.rows.filter((r) => /emi/i.test(r.name))).toHaveLength(1);
  });
});
