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
    expect(bills).toEqual([
      { key: "card:a", kind: "card", label: "Travel card bill", amount: 12_000, dueDate: "2027-02-28" },
    ]);
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
