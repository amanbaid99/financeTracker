import { describe, expect, it } from "vitest";
import { autoAllocate } from "@/lib/auto-allocate";
import { trackGoal, type GoalInput, type Investment } from "@/lib/tracker";

const today = "2026-11-21";

const inv = (
  id: string,
  value: number,
  kind: string,
  category: string | null,
  monthlySip = 0,
): Investment => ({
  id,
  kind,
  name: null,
  category,
  value,
  monthlySip,
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

function run(goals: GoalInput[], investments: Investment[]) {
  const bare = goals.map((g) => trackGoal(g, investments, [], today));
  const auto = autoAllocate(bare, investments, today);
  const tracked = goals.map((g) =>
    trackGoal(g, investments, auto.links, today),
  );
  return { auto, byId: new Map(tracked.map((t) => [t.id, t])) };
}

describe("autoAllocate", () => {
  it("covers money due soon, then the emergency fund, from one liquid fund", () => {
    const { auto, byId } = run(
      [
        goal({
          id: "sinking",
          target: 100000,
          targetDate: "2027-03-01",
        }),
        goal({ id: "emergency", type: "emergency_fund", target: 300000 }),
      ],
      [inv("liquid", 300000, "mutual_fund", "liquid_fund")],
    );
    expect(byId.get("sinking")!.current).toBe(100000);
    expect(byId.get("emergency")!.current).toBe(200000);
    expect(auto.covers.emergency.short).toBe(100000);
    expect(auto.covers.sinking.short).toBe(0);
  });

  it("keeps a floor for the emergency fund when safe money is thin", () => {
    const { byId } = run(
      [
        goal({ id: "trip", target: 200000, targetDate: "2027-02-01" }),
        goal({ id: "emergency", type: "emergency_fund", target: 600000 }),
      ],
      [inv("liquid", 250000, "mutual_fund", "liquid_fund")],
    );
    expect(byId.get("emergency")!.current).toBe(200000);
    expect(byId.get("trip")!.current).toBe(50000);
  });

  it("never uses equity for money needed within a year", () => {
    const { auto, byId } = run(
      [goal({ id: "trip", target: 100000, targetDate: "2027-05-01" })],
      [inv("index", 500000, "mutual_fund", "equity_index")],
    );
    expect(byId.get("trip")!.current).toBe(0);
    expect(auto.covers.trip.short).toBe(100000);
    expect(auto.covers.trip.why).toMatch(/spare equity isn't used/);
    expect(auto.spare.equity).toBe(500000);
  });

  it("lets far goals count on growth, leaving the rest spare", () => {
    const { auto, byId } = run(
      [goal({ id: "house", target: 1000000, targetDate: "2036-11-21" })],
      [inv("index", 2000000, "mutual_fund", "equity_index")],
    );
    const house = byId.get("house")!;
    expect(house.current).toBeLessThan(1000000);
    expect(house.status).toBe("on_track");
    expect(auto.spareTotal).toBeGreaterThan(1000000);
  });

  it("gives a new SIP to the first goal it suits", () => {
    const { auto } = run(
      [
        goal({ id: "trip", target: 100000, targetDate: "2027-05-01" }),
        goal({
          id: "retire",
          type: "retirement",
          target: 5000000,
          targetDate: "2050-01-01",
        }),
      ],
      [inv("newsip", 0, "mutual_fund", "flexi_cap", 10000)],
    );
    expect(auto.links).toEqual([
      { goalId: "retire", investmentId: "newsip", percent: 100 },
    ]);
  });

  it("never gives more than 100% of a holding across goals", () => {
    const { auto } = run(
      [
        goal({ id: "a", target: 500000, targetDate: "2027-01-01" }),
        goal({ id: "b", target: 500000, targetDate: "2027-02-01" }),
      ],
      [inv("liquid", 600000, "mutual_fund", "liquid_fund")],
    );
    const total = auto.links
      .filter((l) => l.investmentId === "liquid")
      .reduce((s, l) => s + l.percent, 0);
    expect(total).toBeLessThanOrEqual(100.0001);
  });
});
