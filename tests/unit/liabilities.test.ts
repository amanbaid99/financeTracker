import { describe, expect, it } from "vitest";
import { liabilities } from "@/lib/liabilities";

const today = "2026-11-16";
const items = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "to_pay" as const,
    label: "Card dues",
    amount: 40000,
    due: "2026-12-10",
    done: false,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    kind: "to_pay" as const,
    label: "Hotel",
    amount: 30000,
    due: null,
    done: false,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    kind: "to_pay" as const,
    label: "Old",
    amount: 5000,
    due: "2026-12-01",
    done: true,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    kind: "owed_to_me" as const,
    label: "Friend",
    amount: 9000,
    due: null,
    done: false,
  },
];

describe("liabilities", () => {
  it("lists payments by date, leaves out paid and owed-to-you, and counts dues as owed", () => {
    const l = liabilities({
      today,
      loans: [],
      bills: [
        { goalId: "g", name: "Insurance", amount: 15000, date: "2026-12-20" },
        { goalId: "g", name: "Far away", amount: 1000, date: "2027-06-01" },
      ],
      items,
      choices: {},
      monthlyLiving: 25000,
    });
    expect(l.until).toBe("2027-01-16");
    expect(l.upcoming.map((u) => u.label)).toEqual([
      "Hotel",
      "Card dues",
      "Insurance",
    ]);
    expect(l.upcoming[0].undated).toBe(true);
    expect(l.payments).toBe(70000);
    expect(l.owed).toBe(70000);
    expect(l.dueTotal).toBe(85000);
  });

  it("runs till the salary date while between jobs", () => {
    const l = liabilities({
      today,
      loans: [],
      bills: [],
      items: [],
      choices: {},
      monthlyLiving: 0,
      until: "2027-01-31",
    });
    expect(l.until).toBe("2027-01-31");
    expect(l.upcoming).toEqual([]);
  });
});
