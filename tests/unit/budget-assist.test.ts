import { describe, expect, it } from "vitest";
import { assistedBudget, confirmedBudget, knownBudgetItems, moneyAvailable, suggestAssistedAllocation } from "@/lib/budget-assist";
import { addScheduledEmis, emptyBudgetSheet, rowAmount, type BudgetSheetRow } from "@/lib/budget-sheet";
const id = "00000000-0000-4000-8000-000000000090";
const loans = [{ id, name: "Personal loan", emi: 10000 }];
const row = (key: string, category: BudgetSheetRow["category"], value: number): BudgetSheetRow => ({ id: key, name: key, category, value, mode: "amount", loanId: null });
describe("assisted budget preparation", () => {
  it("deduplicates manual/source identities, preserves edits and flags uncertain EMI records", () => {
    const plan = addScheduledEmis({ ...emptyBudgetSheet(100000), rows: [row("Rent", "fixed", 20000)] }, loans);
    const items = knownBudgetItems(plan, [{ id: "rent", name: " rent ", amount: 25000 }, { id: "utilities", name: "Utilities", amount: 3000 }, { id: "emi", name: "EMI", amount: 10000 }], loans);
    expect(items.filter((i) => i.row.name.toLowerCase().includes("rent"))).toHaveLength(1);
    expect(items[0].row.value).toBe(20000); expect(items[0].source).toContain("₹25,000");
    expect(items.filter((i) => i.row.loanId)).toHaveLength(1);
    expect(items.find((i) => i.row.name === "EMI")?.included).toBe(false);
    const imported = { ...plan, rows: [...plan.rows, { ...row("recorded-cost-utilities", "fixed", 3500), name: "Electricity" }] };
    expect(knownBudgetItems(imported, [{ id: "utilities", name: "Utilities", amount: 3000 }], loans).filter((i) => i.row.id === "recorded-cost-utilities")).toHaveLength(1);
  });
  it("shows known SIPs without automatically stacking them over existing future budgets", () => {
    const empty = knownBudgetItems(emptyBudgetSheet(100000), [], [], 10000);
    expect(empty.find((i) => i.row.id === "recorded-sips")?.included).toBe(true);
    const existing = { ...emptyBudgetSheet(100000), rows: [row("My investments", "investing", 15000)] };
    expect(knownBudgetItems(existing, [], [], 10000).find((i) => i.row.id === "recorded-sips")?.included).toBe(false);
    const imported = confirmedBudget(emptyBudgetSheet(100000), 100000, empty, []);
    expect(knownBudgetItems(imported, [], [], 10000).filter((i) => i.row.id === "recorded-sips")).toHaveLength(1);
  });
  it("requires review to re-include excluded loans and carries unchecked exclusions into the draft", () => {
    const plan = { ...emptyBudgetSheet(100000), excludedLoanIds: [id] };
    const items = knownBudgetItems(plan, [], loans);
    expect(items[0].included).toBe(false);
    expect(confirmedBudget(plan, 100000, items, []).rows).toHaveLength(0);
    items[0].included = true;
    const included = confirmedBudget(plan, 100000, items, []);
    expect(included.excludedLoanIds).toEqual([]); expect(included.rows[0].loanId).toBe(id);
  });
  it("allocates only the remainder, honours goal needs and preserves existing personal amounts", () => {
    const plan = { ...emptyBudgetSheet(100000), rows: [row("Rent", "fixed", 50000), row("Fun", "personal", 5000)] };
    const goals = [{ type: "emergency_fund", status: "behind", isLoan: false, monthlySip: 0, extraSipNeeded: 20000 }, { type: "custom", status: "behind", isLoan: false, monthlySip: 10000, extraSipNeeded: 10000 }];
    const proposal = suggestAssistedAllocation(plan, goals);
    expect(proposal.allocation.personal).toBe(0);
    expect(proposal.allocation.savings).toBeGreaterThanOrEqual(20000);
    expect(Object.values(proposal.allocation).reduce((a, b) => a + b, 0)).toBe(45000);
    const draft = assistedBudget(plan, proposal.allocation)!;
    expect(moneyAvailable(draft)).toBe(0); expect(plan.rows).toHaveLength(2);
  });
  it("counts existing combined SIP capacity once even when its row is labelled investing", () => {
    const plan = { ...emptyBudgetSheet(50000), rows: [row("fixed", "fixed", 29000), row("recorded-sips", "investing", 20000)] };
    const goals = [{ type: "emergency_fund", status: "on_track", isLoan: false, monthlySip: 10000, extraSipNeeded: 0 }, { type: "custom", status: "on_track", isLoan: false, monthlySip: 10000, extraSipNeeded: 0 }];
    // Both monthly paces are covered already. The surplus uses the disclosed starter split.
    expect(suggestAssistedAllocation(plan, goals).allocation).toEqual({ savings: 480, investing: 320, personal: 200 });
  });
  it("keeps money exact for small/large remainders and allows edits to leave money unassigned", () => {
    for (const salary of [1, 3, 100001, 1e9]) {
      const plan = emptyBudgetSheet(salary), { allocation } = suggestAssistedAllocation(plan, []);
      expect(Object.values(allocation).reduce((a, b) => a + b, 0)).toBe(salary);
      expect(assistedBudget(plan, allocation)).not.toBeNull();
    }
    expect(moneyAvailable(assistedBudget(emptyBudgetSheet(100000), { savings: 1000, investing: 0, personal: 0 })!)).toBe(99000);
    expect(assistedBudget(emptyBudgetSheet(100), { savings: 101, investing: 0, personal: 0 })).toBeNull();
    expect(assistedBudget(emptyBudgetSheet(100), { savings: NaN, investing: 0, personal: 0 })).toBeNull();
  });
  it("does not multiply previous assisted rows on repeated use or change untouched percentage entries", () => {
    const plan = { ...emptyBudgetSheet(100000), rows: [{ ...row("manual", "investing", 10), mode: "percent" as const }] };
    const first = assistedBudget(plan, { savings: 10000, investing: 10000, personal: 5000 })!;
    const second = assistedBudget(first, { savings: 5000, investing: 5000, personal: 0 })!;
    expect(second.rows.filter((r) => r.id === "assisted-savings")).toHaveLength(1);
    expect(second.rows.find((r) => r.id === "assisted-savings")?.value).toBe(15000);
    expect(second.rows[0].mode).toBe("percent"); expect(rowAmount(second.rows[0], second.salary)).toBe(10000);
    expect(first.rows.find((r) => r.id === "assisted-savings")?.value).toBe(10000);
  });
});
