import { describe, expect, it } from "vitest";
import {
  mappingSuggestions,
  tidySuggestions,
  visible,
} from "@/lib/goal-suggestions";
import {
  trackGoal,
  type GoalInput,
  type Investment,
  type Link,
} from "@/lib/tracker";

const today = "2026-11-24";
const inv = (
  id: string,
  kind: string,
  category: string | null,
  value: number,
): Investment => ({
  id,
  kind,
  name: id,
  category,
  value,
  monthlySip: 0,
  returnPct: null,
});
const goal = (g: Partial<GoalInput> & { id: string }): GoalInput => ({
  name: g.id,
  type: "custom",
  target: 100000,
  targetDate: null,
  inflationPct: null,
  ...g,
});

describe("mappingSuggestions", () => {
  const funds = [
    inv("liquid", "mutual_fund", "liquid_fund", 100000),
    inv("index", "mutual_fund", "equity_index", 200000),
  ];
  const goals = [goal({ id: "trip", targetDate: "2027-06-01" })].map((g) =>
    trackGoal(g, funds, [], today),
  );

  it("suggests a mapping when the app's differs from yours", () => {
    const current: Link[] = [
      { goalId: "trip", investmentId: "index", percent: 50 },
    ];
    const proposed: Link[] = [
      { goalId: "trip", investmentId: "liquid", percent: 100 },
    ];
    const s = mappingSuggestions(goals, funds, current, proposed);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      goalName: "trip",
      now: "index",
      proposed: [{ investmentId: "liquid", percent: 100, value: 100000 }],
    });
  });

  it("stays quiet when they match", () => {
    const same: Link[] = [
      { goalId: "trip", investmentId: "liquid", percent: 100 },
    ];
    expect(mappingSuggestions(goals, funds, same, same)).toEqual([]);
  });
});

describe("tidySuggestions", () => {
  it("flags equity covering money needed within a year", () => {
    const funds = [inv("index", "mutual_fund", "equity_index", 50000)];
    const goals = [goal({ id: "trip", targetDate: "2027-03-01" })].map((g) =>
      trackGoal(g, funds, [], today),
    );
    const t = tidySuggestions(
      goals,
      funds,
      [{ goalId: "trip", investmentId: "index", percent: 100 }],
      { spare: {}, spareTotal: 0 },
    );
    expect(t.map((x) => x.key)).toEqual(["tidy:unsuited:index"]);
  });
});

describe("visible", () => {
  it("hides what you put off until that date", () => {
    const items = [{ key: "a" }, { key: "b" }];
    expect(
      visible(items, { a: "2026-12-01", b: "2026-11-20" }, today).map(
        (i) => i.key,
      ),
    ).toEqual(["b"]);
  });
});
