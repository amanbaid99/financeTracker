import { describe, expect, it } from "vitest";
import { milestoneLabel } from "@/lib/milestone-label";
describe("milestone reward labels", () => {
  it("describes a fee waiver target without asserting the fee has been waived", () => {
    const saved = { name: "Annual fee waiver", reward: "Annual fee waived" };
    expect(milestoneLabel(saved)).toBe("Annual fee waiver");
    expect(saved.reward).toBe("Annual fee waived");
  });
  it("groups points without double-formatting numbers already grouped", () => {
    expect(
      milestoneLabel({ name: "Bonus", reward: "10000 bonus points" }),
    ).toBe("10,000 bonus points");
    expect(
      milestoneLabel({ name: "Bonus", reward: "10,000 bonus points" }),
    ).toBe("10,000 bonus points");
    expect(milestoneLabel({ name: "10000 points", reward: null })).toBe(
      "10,000 points",
    );
  });
  it("preserves other benefit descriptions", () => {
    expect(
      milestoneLabel({ name: "Lounge reward", reward: "4 lounge visits" }),
    ).toBe("4 lounge visits");
  });
});
