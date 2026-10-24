import { describe, expect, it } from "vitest";
import { buildMonthBills, type BillInputs } from "@/lib/bills";

const base: BillInputs = { todayISO: "2026-10-24", cards: [], emis: [], insurance: [], planned: [], sips: [] };

describe("this month's bills", () => {
  it("includes card bills on their due day, clamped to the month", () => {
    const bills = buildMonthBills({
      ...base,
      todayISO: "2027-02-10",
      cards: [
        { id: "a", label: "Travel card", outstanding: 12_000, dueDay: 31 },
        { id: "b", label: "Zero card", outstanding: 0, dueDay: 5 },
      ],
    });
    expect(bills).toHaveLength(1);
    expect(bills[0]).toMatchObject({ key: "card:a", amount: 12_000, dueDate: "2027-02-28", status: "due" });
  });

  it("a card bill is 'not generated yet' before its statement day, with spend so far", () => {
    const card = { id: "c", label: "Card", outstanding: 8_000, statementDay: 26, dueDay: 30 };
    const before = buildMonthBills({ ...base, todayISO: "2026-10-24", cards: [card] })[0];
    expect(before).toMatchObject({ status: "not_generated", amount: null, estimate: 8_000, generatesOn: "2026-10-26" });
    const after = buildMonthBills({ ...base, todayISO: "2026-10-27", cards: [card] })[0];
    expect(after).toMatchObject({ status: "due", amount: 8_000 });
  });

  it("uses the billed amount once entered, and statements from last month are already out", () => {
    const bills = buildMonthBills({
      ...base,
      todayISO: "2026-10-03",
      cards: [
        { id: "c", label: "Card", outstanding: 8_000, statementDay: 26, dueDay: 30 },
        { id: "d", label: "Other", outstanding: 4_000, statementDay: 20, dueDay: 8 },
      ],
      monthBills: [
        { id: "r", month: "2026-10-01", seriesId: "s", label: "Card", amount: 7_500, dueDay: null, recurring: false, cardId: "c" },
      ],
    });
    expect(bills.find((b) => b.key === "card:c")).toMatchObject({ amount: 7_500, status: "due" });
    // Statement on the 20th, due the 8th: this month's bill came out last month.
    expect(bills.find((b) => b.key === "card:d")).toMatchObject({ amount: 4_000, status: "due" });
  });

  it("custom bills: blank amount is not generated, repeating bills come back each month", () => {
    const bills = buildMonthBills({
      ...base,
      todayISO: "2026-10-24",
      monthBills: [
        { id: "e9", month: "2026-09-01", seriesId: "elec", label: "Electricity", amount: 2_100, dueDay: 15, recurring: true, cardId: null },
        { id: "p10", month: "2026-10-01", seriesId: "phone", label: "Phone", amount: 600, dueDay: 28, recurring: true, cardId: null },
        { id: "o9", month: "2026-09-01", seriesId: "once", label: "Plumber", amount: 900, dueDay: null, recurring: false, cardId: null },
        { id: "w10", month: "2026-10-01", seriesId: "water", label: "Water", amount: null, dueDay: 30, recurring: false, cardId: null },
      ],
    });
    const byLabel = Object.fromEntries(bills.map((b) => [b.label, b]));
    expect(byLabel.Electricity).toMatchObject({ status: "not_generated", amount: null, edit: { rowId: null } });
    expect(byLabel.Phone).toMatchObject({ status: "due", amount: 600 });
    expect(byLabel.Water).toMatchObject({ status: "not_generated", amount: null });
    expect(byLabel.Plumber).toBeUndefined();
  });

  it("marks past due dates as overdue", () => {
    const bills = buildMonthBills({
      ...base,
      todayISO: "2026-10-24",
      monthBills: [
        { id: "x", month: "2026-10-01", seriesId: "x", label: "Rent top-up", amount: 1_000, dueDay: 5, recurring: false, cardId: null },
      ],
    });
    expect(bills[0].status).toBe("overdue");
  });

  it("monthly premiums use the debit day; yearly ones only in their renewal month", () => {
    const ins = (id: string, frequency: BillInputs["insurance"][number]["frequency"], renewalDate: string | null) => ({
      id,
      label: id,
      premium: 1_000,
      frequency,
      debitDay: 7,
      renewalDate,
      renewalMonth: null,
    });
    const keys = buildMonthBills({
      ...base,
      insurance: [
        ins("monthly", "monthly", null),
        ins("yearly-now", "yearly", "2025-10-15"),
        ins("yearly-later", "yearly", "2026-03-15"),
        ins("quarterly-now", "quarterly", "2026-01-20"),
        ins("half-later", "half_yearly", "2026-01-20"),
      ],
    }).map((b) => `${b.key}@${b.dueDate}`);
    expect(keys).toEqual([
      "ins:monthly@2026-10-07",
      "ins:yearly-now@2026-10-15",
      "ins:quarterly-now@2026-10-20",
    ]);
  });

  it("includes planned expenses due this month or overdue", () => {
    const bills = buildMonthBills({
      ...base,
      planned: [
        { id: "gym", name: "Gym", amount: 12_000, nextDue: "2026-10-30" },
        { id: "bike", name: "Bike service", amount: 3_000, nextDue: "2026-08-01" },
        { id: "later", name: "AC service", amount: 2_000, nextDue: "2027-04-01" },
      ],
    });
    expect(bills.map((b) => [b.label, b.overdue])).toEqual([
      ["Bike service", true],
      ["Gym", false],
    ]);
  });

  it("lists EMIs and SIPs every month without dates", () => {
    const bills = buildMonthBills({
      ...base,
      emis: [{ id: "h", label: "Home loan EMI", emi: 25_000 }],
      sips: [{ id: "s", label: "Index fund", sip: 5_000 }],
    });
    expect(bills.map((b) => b.kind)).toEqual(["emi", "sip"]);
  });
});
