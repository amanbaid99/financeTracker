import { describe, expect, it } from "vitest";
import { addScheduledEmis, budgetSheetSchema, emptyBudgetSheet, readBudgetSheet, rowAmount, rowPercent, sheetTotals, type BudgetSheetRow } from "@/lib/budget-sheet";
import { defaultRatioPlan } from "@/lib/budget-ratios";
const loanId = "00000000-0000-4000-8000-000000000090";
const loans = [{ id: loanId, name: "My loan", emi: 10000 }];
const row = (mode: BudgetSheetRow["mode"], value: number): BudgetSheetRow => ({ id: "row", name: "Savings", category: "savings", mode, value, loanId: null });
describe("manual budget sheet", () => {
  it("converts rupees and percentage both ways without changing the typed basis", () => {
    const amount = row("amount", 20000), percent = row("percent", 20);
    expect(rowPercent(amount, 100000)).toBe(20);
    expect(rowAmount(percent, 100000)).toBe(20000);
    expect(rowAmount(amount, 200000)).toBe(20000);
    expect(rowPercent(amount, 200000)).toBe(10);
    expect(rowAmount(percent, 200000)).toBe(40000);
    expect(rowPercent(percent, 200000)).toBe(20);
    expect(rowAmount(row("percent", 33.33), 10001)).toBe(3333);
    expect(rowPercent(amount, 0)).toBe(0);
  });
  it("does not normalise rows to 100% and allows an explicit over-budget plan", () => {
    const plan = { ...emptyBudgetSheet(100000), rows: [row("amount", 120000)] };
    expect(sheetTotals(plan)).toEqual({ allocated: 120000, remaining: -20000, percent: 120 });
    expect(budgetSheetSchema.safeParse(plan).success).toBe(true);
    expect(sheetTotals({ ...plan, rows: [] }).remaining).toBe(100000);
  });
  it("adds every active EMI once as a fixed expense and remembers removals", () => {
    const plan = addScheduledEmis(emptyBudgetSheet(100000), loans);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]).toMatchObject({ category: "fixed", mode: "amount", value: 10000, loanId });
    expect(addScheduledEmis(plan, loans).rows).toHaveLength(1);
    const edited = { ...plan, rows: [{ ...plan.rows[0], value: 9000 }] };
    expect(addScheduledEmis(edited, loans).rows[0].value).toBe(9000);
    expect(addScheduledEmis({ ...plan, rows: [], excludedLoanIds: [loanId] }, loans).rows).toEqual([]);
    expect(addScheduledEmis(plan, []).rows).toEqual([]);
  });
  it("preserves older allocations and absorbs existing debt before adding loan rows", () => {
    const old = defaultRatioPlan(100000);
    old.buckets = old.buckets.map((b) => ({ ...b, percent: b.kind === "fixed" ? 40 : b.kind === "debt" ? 10 : b.percent }));
    old.buckets[3].children = [{ id: "safety", label: "Safety", percent: 60, goalId: null }];
    const before = JSON.stringify(old);
    const converted = readBudgetSheet(old, 1, loans)!;
    expect(converted.version).toBe(2);
    expect(sheetTotals(converted).allocated).toBe(100000);
    expect(converted.rows.filter((r) => r.loanId)).toHaveLength(1);
    expect(converted.rows.find((r) => r.name === "Safety")?.value).toBe(12000);
    expect(converted.rows.some((r) => r.category === "debt")).toBe(false);
    expect(JSON.stringify(old)).toBe(before);
    expect(budgetSheetSchema.safeParse(converted).success).toBe(true);
  });
  it("rejects malformed entries, duplicate rows/loans and unsafe calculated amounts", () => {
    for (const r of [row("amount", -1), row("amount", 1.5), row("percent", Infinity), row("percent", 1.111), row("percent", 10000)]) {
      expect(budgetSheetSchema.safeParse({ ...emptyBudgetSheet(1e9), rows: [r] }).success).toBe(false);
    }
    const r = row("amount", 1);
    expect(budgetSheetSchema.safeParse({ ...emptyBudgetSheet(100), rows: [r, r] }).success).toBe(false);
    expect(readBudgetSheet({ version: 9 }, 100000, loans)).toBeNull();
  });
});
