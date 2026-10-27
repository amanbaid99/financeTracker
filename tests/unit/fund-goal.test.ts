import { describe, expect, it } from "vitest";
import { waysToFund } from "@/lib/fund-goal";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";

const inv = (id: string, kind: string, category: string | null, value: number): Investment =>
  ({ id, kind, category, name: id, value, monthlySip: 0, returnPct: null, invested: null }) as Investment;
const goal = (over: Partial<TrackedGoal>): TrackedGoal =>
  ({
    id: "g",
    name: "Goal",
    type: "travel",
    status: "no_investments",
    lines: [],
    months: 18,
    targetDate: "2028-04-01",
    extraSipNeeded: 12_345,
    emisCloseFirst: false,
    ...over,
  }) as TrackedGoal;

const fd = inv("fd", "fd", null, 100_000);
const savings = inv("sav", "savings", null, 50_000);
const index = inv("idx", "mutual_fund", "equity_index", 300_000);
const ppf = inv("ppf", "ppf", null, 200_000);

describe("ways to fund a goal", () => {
  it("near goals: safe holdings only, biggest first, and a liquid or debt fund", () => {
    const w = waysToFund(goal({ months: 18 }), [index, savings, fd, ppf], []);
    expect(w.existing.map((o) => o.investment.id)).toEqual(["fd", "sav"]);
    expect(w.fresh).toMatchObject({ category: "short_debt_fund", monthly: 12_345 });
  });

  it("far goals: equity first, safe holdings as a slower option", () => {
    const w = waysToFund(goal({ months: 120, targetDate: "2036-01-01" }), [fd, index], []);
    expect(w.existing.map((o) => [o.investment.id, o.fit])).toEqual([
      ["idx", "good"],
      ["fd", "ok"],
    ]);
    expect(w.fresh?.category).toBe("equity_index");
  });

  it("only offers what isn't already used by other goals", () => {
    const links: Link[] = [
      { goalId: "other", investmentId: "fd", percent: 100 },
      { goalId: "other", investmentId: "sav", percent: 60 },
    ];
    const w = waysToFund(goal({}), [fd, savings], links);
    expect(w.existing).toHaveLength(1);
    expect(w.existing[0]).toMatchObject({ freePercent: 40, freeValue: 20_000 });
  });

  it("suggests nothing for goals already reached or covered by EMIs", () => {
    expect(waysToFund(goal({ status: "reached" }), [fd], [])).toEqual({ existing: [], fresh: null });
    expect(waysToFund(goal({ emisCloseFirst: true }), [fd], [])).toEqual({ existing: [], fresh: null });
  });

  it("no date: no monthly amount", () => {
    expect(waysToFund(goal({ months: null, targetDate: null }), [], []).fresh?.monthly).toBe(0);
  });
});
