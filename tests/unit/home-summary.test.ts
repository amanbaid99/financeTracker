import { describe, expect, it } from "vitest";
import { homeCardSummary, homeGoals } from "@/lib/home-summary";
import type { Card } from "@/lib/cards";
import { trackGoal } from "@/lib/tracker";
const card: Card = {
  id: "a",
  label: "Everyday card",
  annualFee: null,
  yearStart: null,
  rewards: null,
  benefits: [],
  bestFor: [],
  milestones: [],
  bills: [],
};
const bill = {
  id: "b",
  month: "2026-10-01",
  amount: 1000,
  dueDate: "2026-11-10",
  paid: false,
  note: null,
};
describe("Home card statement figures", () => {
  it("uses a named latest statement month, counts paid statements in their month, and separates all unpaid bills", () => {
    const result = homeCardSummary(
      [
        {
          ...card,
          bills: [
            bill,
            {
              ...bill,
              id: "old",
              month: "2026-09-01",
              amount: 500,
              paid: true,
            },
          ],
        },
        {
          ...card,
          id: "c",
          bills: [{ ...bill, id: "paid", amount: 2000, paid: true }],
        },
      ],
      "2026-11-06",
    );
    expect(result).toEqual({
      month: "2026-10",
      total: 3000,
      cardsUpdated: 2,
      cards: 2,
      unpaid: 1000,
    });
  });
  it("reports incomplete month coverage and does not substitute a different month's statement", () => {
    expect(
      homeCardSummary(
        [
          { ...card, bills: [bill] },
          { ...card, id: "c", bills: [{ ...bill, month: "2026-09-01" }] },
        ],
        "2026-11-06",
      ),
    ).toMatchObject({
      month: "2026-10",
      total: 1000,
      cardsUpdated: 1,
      cards: 2,
    });
  });
  it("distinguishes no statements from a logged zero bill and ignores future statement months", () => {
    expect(homeCardSummary([card], "2026-11-06").month).toBeNull();
    expect(
      homeCardSummary(
        [{ ...card, bills: [{ ...bill, month: "2026-12-01" }] }],
        "2026-11-06",
      ).month,
    ).toBeNull();
    expect(
      homeCardSummary(
        [{ ...card, bills: [{ ...bill, amount: 0 }] }],
        "2026-11-06",
      ),
    ).toMatchObject({ month: "2026-10", total: 0, cardsUpdated: 1 });
  });
});
it("previews at most three active goals without altering inputs or including reached goals", () => {
  const goals = [1, 2, 3, 4].map((n) =>
    trackGoal(
      {
        id: String(n),
        name: "Goal",
        type: "custom",
        target: 10000,
        targetDate: `2027-0${n}-01`,
        inflationPct: 0,
      },
      [],
      [],
      "2026-11-06",
    ),
  );
  const reached = { ...goals[0], id: "done", status: "reached" as const };
  const before = JSON.stringify(goals);
  expect(homeGoals([...goals, reached])).toHaveLength(3);
  expect(homeGoals([...goals, reached]).some((g) => g.id === "done")).toBe(
    false,
  );
  expect(JSON.stringify(goals)).toBe(before);
});
