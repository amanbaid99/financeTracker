import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/cards";
import { cardsLine, goalsLine, greeting, needsYou } from "@/lib/home";
import type { TrackedGoal } from "@/lib/tracker";

const TODAY = "2026-10-27";
const goal = (over: Partial<TrackedGoal>): TrackedGoal =>
  ({
    id: "g",
    name: "House",
    type: "house",
    status: "on_track",
    extraSipNeeded: 0,
    billsFund: null,
    targetDate: "2031-10-01",
    reachDate: null,
    ...over,
  }) as TrackedGoal;
const card = (over: Partial<Card>): Card => ({
  id: "c",
  label: "HDFC",
  annualFee: 500,
  yearStart: null,
  rewards: null,
  benefits: [],
  bestFor: [],
  milestones: [],
  bills: [],
  unbilled: 0,
  unbilledAsOf: null,
  ...over,
});
const bill = (month: string, over = {}) => ({
  id: month,
  month,
  amount: 10_000,
  dueDate: null,
  paid: true,
  note: null,
  ...over,
});

describe("needs you", () => {
  it("is empty when everything is fine", () => {
    expect(needsYou([goal({})], [card({ bills: [bill("2026-09-01")] })], TODAY)).toEqual([]);
  });

  it("lists overdue goals first, then goals behind, then nudges", () => {
    const items = needsYou(
      [
        goal({ id: "a", name: "Trip", status: "behind", extraSipNeeded: 5000 }),
        goal({ id: "b", name: "Car", status: "overdue" }),
      ],
      [card({ bills: [bill("2026-08-01")] })],
      TODAY,
    );
    expect(items.map((i) => i.title)).toEqual(["Car", "Trip", "Log your Sep HDFC bill"]);
    expect(items[1]).toMatchObject({ detail: "Needs ₹5,000 more a month", href: "/goals?open=a" });
  });

  it("flags unpaid bills due within a week, and overdue ones", () => {
    const items = needsYou(
      [],
      [
        card({
          bills: [
            bill("2026-09-01", { paid: false, dueDate: "2026-10-30" }),
            bill("2026-08-01", { id: "old", paid: false, dueDate: "2026-09-25" }),
          ],
        }),
      ],
      TODAY,
    );
    expect(items.map((i) => [i.title, i.urgency])).toEqual([
      ["HDFC bill overdue", "danger"],
      ["HDFC bill due 30 Oct", "warning"],
    ]);
  });
});

describe("home lines", () => {
  it("summarises goals and cards", () => {
    expect(goalsLine([goal({}), goal({ status: "behind" })])).toBe("2 goals · 1 on track");
    expect(goalsLine([])).toBe("Add your first goal");
    expect(cardsLine([], TODAY)).toBe("Add a card to track its milestones");
  });

  it("greets by the hour in India", () => {
    expect(greeting(new Date("2026-10-27T03:00:00Z"))).toBe("Good morning"); // 8:30 IST
    expect(greeting(new Date("2026-10-27T14:00:00Z"))).toBe("Good evening"); // 19:30 IST
  });
});
