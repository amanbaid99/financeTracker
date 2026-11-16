import { describe, expect, it } from "vitest";
import type { Loan } from "@/lib/loans";
import { betweenJobs, runway, type RunwayItem } from "@/lib/runway";

const TODAY = "2026-11-16";
const loan = (over: Partial<Loan>): Loan => ({
  id: "l",
  name: "Loan",
  type: "personal",
  cardId: null,
  principal: null,
  takenOn: null,
  ratePct: 12,
  emi: 10000,
  monthsLeft: null,
  totalEmis: null,
  emiDay: 5,
  billDay: null,
  firstEmi: null,
  outstanding: 300000,
  asOf: "2026-11-05",
  foreclosurePct: null,
  foreclosureGst: true,
  payments: [],
  goal: null,
  ...over,
});

// Shaped like a real gap between jobs (amounts anonymised a little).
const loans = [
  loan({ id: "a", name: "Loan A", emi: 13711, emiDay: 3, outstanding: 141474, asOf: "2026-11-03" }),
  loan({ id: "b", name: "Loan B", emi: 5102, emiDay: 18, outstanding: 181282, asOf: "2026-11-18" }),
  loan({ id: "c", name: "Loan C", emi: 9913, emiDay: 18, outstanding: 324835, asOf: "2026-11-18" }),
];
// A bills fund that also lists the EMIs and monthly costs.
const bills = [
  { goalId: "g", name: "Dec expenses", amount: 25000, date: "2026-12-01" },
  { goalId: "g", name: "A emi 2", amount: 13711, date: "2026-12-03" },
  { goalId: "g", name: "B and C emi 2", amount: 15015, date: "2026-12-15" },
  { goalId: "g", name: "Settlement", amount: 30000, date: "2027-01-01" },
  { goalId: "g", name: "Insurance", amount: 15000, date: "2027-02-01" },
];
const items: RunwayItem[] = [
  { id: "c1", kind: "to_pay", label: "Card 1", amount: 153288, due: "2026-12-05", done: false },
  { id: "c2", kind: "to_pay", label: "Card 2", amount: 113524, due: null, done: false },
  { id: "o1", kind: "owed_to_me", label: "Friends", amount: 22000, due: null, done: false },
  { id: "x", kind: "to_pay", label: "Paid already", amount: 9999, due: null, done: true },
];
const investments = [
  { kind: "savings", category: "savings_account", value: 121189 },
  { kind: "mutual_fund", category: "liquid_fund", value: 239000 },
  { kind: "savings", category: "savings_account", value: 10000 },
  { kind: "epf", category: "epf_vpf", value: 200000 },
];

const base = {
  today: TODAY,
  salaryBest: "2027-01-05",
  salaryWorst: "2027-01-31",
  investments,
  loans,
  monthlyLiving: 25000,
  bills,
  items,
  choices: {},
};

describe("covered till salary", () => {
  it("adds up EMIs, living costs, card dues and one-off payments until the latest salary", () => {
    const r = runway(base);
    expect(r.liquid).toBe(370189);
    expect(r.owedToYou).toBe(22000);
    const w = r.worst;
    const emis = w.lines.filter((l) => l.source === "emi");
    // Dec and Jan for each loan; Nov EMIs are past or already marked paid.
    expect(emis.map((l) => l.date)).toEqual([
      "2026-12-03", "2026-12-18", "2026-12-18", "2027-01-03", "2027-01-18", "2027-01-18",
    ]);
    expect(emis.reduce((s, l) => s + l.amount, 0)).toBe(57452);
    expect(w.lines.find((l) => l.key === "living")!.amount).toBe(62466);
    // 4,16,730 due against 3,70,189.
    expect(w.due).toBe(57452 + 62466 + 30000 + 266812);
    expect(w.left).toBe(370189 - w.due);
    expect(w.leftWithOwed).toBe(w.left + 22000);
  });

  it("doesn't count a bills-fund line that repeats an EMI or living costs, unless you say so", () => {
    const w = runway(base).worst;
    const bill = (name: string) => w.lines.find((l) => l.label === name)!;
    expect(bill("Dec expenses").counted).toBe(false);
    expect(bill("A emi 2").counted).toBe(false);
    expect(bill("B and C emi 2").counted).toBe(false);
    expect(bill("Settlement").counted).toBe(true);
    // Insurance falls after the salary, so it isn't listed.
    expect(w.lines.find((l) => l.label === "Insurance")).toBeUndefined();
    const forced = runway({ ...base, choices: { [bill("A emi 2").key]: true } }).worst;
    expect(forced.due).toBe(w.due + 13711);
  });

  it("is kinder with an early salary, and trims the weekly amount only when short", () => {
    const r = runway(base);
    expect(r.best.due).toBeLessThan(r.worst.due);
    expect(r.best.lines.filter((l) => l.source === "emi")).toHaveLength(4);
    // Short in the worst case: the weekly amount is below the usual ₹25k a month.
    expect(r.worst.weekly).toBeLessThan(Math.round((25000 * 12) / 52));
    const rich = runway({ ...base, investments: [{ kind: "savings", category: "savings_account", value: 900000 }] });
    expect(rich.worst.left).toBeGreaterThan(0);
    expect(rich.worst.weekly).toBe(5700);
  });

  it("knows when you're between jobs", () => {
    expect(betweenJobs({ salary_best: "2027-01-05", salary_worst: "2027-01-31" }, TODAY)).toBe(true);
    expect(betweenJobs({ salary_best: "2026-10-01", salary_worst: "2026-10-31" }, TODAY)).toBe(false);
    expect(betweenJobs({ salary_best: null, salary_worst: null }, TODAY)).toBe(false);
  });
});
