import { describe, expect, it } from "vitest";
import { mergeMapping } from "@/lib/mapping-merge";

const r = (goalId: string, investmentId: string, percent: number) => ({
  goalId,
  investmentId,
  percent,
});
const use = (rows: ReturnType<typeof r>[], inv: string) =>
  rows.filter((x) => x.investmentId === inv).reduce((s, x) => s + x.percent, 0);

describe("mergeMapping", () => {
  it("shrinks other goals' shares to make room for your new choice", () => {
    const saved = [r("emergency", "liquid", 70), r("sinking", "liquid", 30)];
    const out = mergeMapping(saved, ["trip"], [r("trip", "liquid", 50)]);
    expect(use(out, "liquid")).toBeLessThanOrEqual(100);
    expect(out.find((x) => x.goalId === "trip")!.percent).toBe(50);
    expect(out.find((x) => x.goalId === "emergency")!.percent).toBe(35);
    expect(out.find((x) => x.goalId === "sinking")!.percent).toBe(15);
  });

  it("leaves other goals alone when there's room", () => {
    const saved = [r("emergency", "liquid", 40)];
    const out = mergeMapping(saved, ["trip"], [r("trip", "liquid", 50)]);
    expect(out.find((x) => x.goalId === "emergency")!.percent).toBe(40);
  });

  it("replaces only the goals being changed", () => {
    const saved = [r("trip", "bank", 100), r("house", "index", 100)];
    const out = mergeMapping(saved, ["trip"], [r("trip", "liquid", 100)]);
    expect(out).toEqual([r("house", "index", 100), r("trip", "liquid", 100)]);
  });

  it("drops a goal that takes a whole holding from another", () => {
    const out = mergeMapping([r("a", "x", 100)], ["b"], [r("b", "x", 100)]);
    expect(out).toEqual([r("b", "x", 100)]);
  });
});
