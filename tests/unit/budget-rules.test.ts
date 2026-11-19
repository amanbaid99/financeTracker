import { describe, expect, it } from "vitest";
import { applyBudgetRules, budgetRuleGaps, budgetSheetSchema, emptyBudgetSheet, readBudgetSheet, rowAmount, sheetTotals, type BudgetSheet, type BudgetSheetRow } from "@/lib/budget-sheet";
const row = (id: string, category: BudgetSheetRow["category"], value: number): BudgetSheetRow => ({ id, name: id, category, mode: "amount", value, loanId: null });
const plan = (): BudgetSheet => ({ ...emptyBudgetSheet(100000), rules: { savings: { mode: "percent", value: 20 }, investing: { mode: "percent", value: 20 } }, rows: [row("rent", "fixed", 40000), row("SIP", "investing", 10000), row("emergency", "savings", 10000), row("commute", "personal", 5000)] });
const amount = (p: BudgetSheet, category: BudgetSheetRow["category"]) => p.rows.filter(r => r.category === category).reduce((s,r) => s+rowAmount(r,p.salary),0);
describe("persistent budget targets", () => {
 it("counts existing savings and SIPs inside targets and puts only the remainder into personal spending", () => {
  const original = plan(), result = applyBudgetRules(original);
  expect(amount(result,"savings")).toBe(20000); expect(amount(result,"investing")).toBe(20000);
  expect(amount(result,"personal")).toBe(20000); expect(result.rows.find(r=>r.id==="rule-personal")?.value).toBe(15000);
  expect(sheetTotals(result).remaining).toBe(0); expect(original.rows).toHaveLength(4);
  expect(applyBudgetRules(result)).toEqual(result);
 });
 it("sends all of a removed cost to personal spending without increasing targets", () => {
  const result=applyBudgetRules(plan());
  const changed=applyBudgetRules({...result, rows:result.rows.filter(r=>r.id!=="rent")});
  expect(amount(changed,"personal")-amount(result,"personal")).toBe(40000);
  expect(amount(changed,"savings")).toBe(20000); expect(amount(changed,"investing")).toBe(20000);
 });
 it("earmarks personal costs from free spending instead of adding a second expense", () => {
  const result=applyBudgetRules({...applyBudgetRules(plan()), rows:[...applyBudgetRules(plan()).rows,row("fun","personal",3000)]});
  expect(amount(result,"personal")).toBe(20000);expect(result.rows.find(r=>r.id==="rule-personal")?.value).toBe(12000);
 });
 it("keeps rupee targets fixed and percentage targets responsive to income", () => {
  const p=plan();p.rules!.savings={mode:"amount",value:20000};p.salary=150000;
  const result=applyBudgetRules(p);expect(amount(result,"savings")).toBe(20000);expect(amount(result,"investing")).toBe(30000);
 });
 it("shows shortfalls without shrinking commitments or targets", () => {
  const p=plan();p.rows.push(row("bill","fixed",50000));const result=applyBudgetRules(p);
  expect(sheetTotals(result).remaining).toBe(-35000);expect(result.rows.find(r=>r.id==="rule-personal")).toBeUndefined();
  expect(amount(result,"investing")).toBe(20000);expect(amount(result,"savings")).toBe(20000);
 });
 it("preserves named allocations above target and exposes the discrepancy", () => {
  const p=plan();p.rules!.savings.value=5;const result=applyBudgetRules(p);
  expect(amount(result,"savings")).toBe(10000);expect(budgetRuleGaps(result)).toEqual([{category:"savings",excess:5000}]);
 });
 it("persists rules across reads and keeps old manual budgets unchanged", () => {
  const result=applyBudgetRules(plan());expect(readBudgetSheet(result,100000,[])).toEqual(result);
  const old=emptyBudgetSheet(100000);old.rows=[row("rent","fixed",40000)];expect(applyBudgetRules(old)).toEqual(old);expect(budgetSheetSchema.parse(old)).toEqual(old);
 });
 it("validates rule bounds and integer rupees", () => {
  for(const target of [{mode:"percent",value:101},{mode:"percent",value:20.123},{mode:"amount",value:1.5},{mode:"amount",value:-1}])expect(budgetSheetSchema.safeParse({...plan(),rules:{savings:target,investing:{mode:"percent",value:20}}}).success).toBe(false);
 });
});
