import { describe, expect, it } from "vitest";
import { cardsForMilestones, type Card, type Milestone } from "@/lib/cards";
const today = "2026-11-16";
const milestone: Milestone = {
  id: "fee",
  name: "Fee waiver",
  target: 10000,
  period: "calendar_year",
  deadline: null,
  reward: null,
  createdAt: "2026-01-01T00:00:00Z",
};
const card = (id: string, target = 10000): Card => ({
  id,
  label: id,
  annualFee: null,
  yearStart: null,
  rewards: null,
  benefits: [],
  bestFor: [],
  milestones: [{ ...milestone, target }],
  bills: [
    {
      id: `${id}-bill`,
      month: "2026-11-01",
      amount: 20000,
      dueDate: null,
      paid: true,
      note: null,
    },
  ],
});
describe("milestone-first card ordering", () => {
  it("moves fully reached cards last while preserving both groups and the input", () => {
    const cards = [
      card("done-a"),
      card("active-a", 50000),
      card("done-b"),
      card("active-b", 80000),
    ];
    const before = JSON.stringify(cards);
    expect(cardsForMilestones(cards, today).map((c) => c.id)).toEqual([
      "active-a",
      "active-b",
      "done-a",
      "done-b",
    ]);
    expect(JSON.stringify(cards)).toBe(before);
  });
  it("places no-milestone cards last, after unfinished and fully reached cards", () => {
    const done = card("done");
    const none = { ...card("none"), milestones: [] };
    const mixed = {
      ...card("mixed"),
      milestones: [milestone, { ...milestone, id: "bonus", target: 50000 }],
    };
    const missed = {
      ...card("missed"),
      milestones: [
        { ...milestone, period: "once" as const, deadline: "2026-10-01" },
      ],
    };
    expect(
      cardsForMilestones([done, none, mixed, missed], today).map((c) => c.id),
    ).toEqual(["mixed", "missed", "done", "none"]);
  });
  it("moves a completed monthly card back up when its period resets", () => {
    const monthly = {
      ...card("monthly"),
      milestones: [{ ...milestone, period: "month" as const }],
    };
    const active = card("active", 50000);
    expect(
      cardsForMilestones([monthly, active], today).map((c) => c.id),
    ).toEqual(["active", "monthly"]);
    expect(
      cardsForMilestones([monthly, active], "2026-12-01").map((c) => c.id),
    ).toEqual(["monthly", "active"]);
  });
  it("does not use legacy bill payment flags to order milestone cards", () => {
    const done = {
      ...card("done"),
      bills: [{ ...card("done").bills[0], paid: false, dueDate: "2026-01-01" }],
    };
    expect(
      cardsForMilestones([done, card("active", 50000)], today).map((c) => c.id),
    ).toEqual(["active", "done"]);
  });
});
