import { describe, expect, it } from "vitest";
import { focusGoals, nextMilestone } from "@/lib/home";
import type { TrackedGoal } from "@/lib/tracker";
import type { Card, Milestone } from "@/lib/cards";
import type { Loan } from "@/lib/loans";

const today = "2026-11-18";
const goal = (id: string, planRank: number, status = "on_track") => ({
  id, name: id, type: "custom", status, planRank, targetDate: "2027-01-01", months: 2,
}) as TrackedGoal;
const milestone = (id: string, deadline: string | null, target = 10000): Milestone => ({
  id, name: "Bonus points", reward: null, period: "once", deadline, target, createdAt: "2026-01-01T00:00:00Z",
});
const card = (milestones: Milestone[], amount = 1000): Card => ({
  id: "card-a", label: "Everyday card", annualFee: null, yearStart: null, rewards: null, benefits: [], bestFor: [], milestones,
  bills: [{ id: "bill", month: "2026-11-01", amount, paid: true, dueDate: null, note: null }],
});
describe("Home focus", () => {
  it("follows the user's order, skips reached goals and caps the list at three", () => {
    const goals = [goal("four", 4), goal("done", 0, "reached"), goal("two", 2), goal("one", 1), goal("three", 3)];
    expect(focusGoals(goals, today).map((g) => g.id)).toEqual(["one", "two", "three"]);
    expect(goals[0].id).toBe("four");
    expect(focusGoals([goal("done", 0, "reached")], today)).toEqual([]);
  });
  it("leaves completed, expired and invalid targets out and uses deadlines to break equal progress", () => {
    const result = nextMilestone([card([
      milestone("later", "2026-12-31"), milestone("done", "2026-11-20", 100),
      milestone("expired", "2026-10-31"), milestone("next", "2026-11-30"),
      milestone("invalid", "2026-11-19", 0), milestone("undated", null),
    ])], [], today);
    expect(result?.state.id).toBe("next");
    expect(result?.state.remaining).toBe(9000);
    expect(nextMilestone([], [], today)).toBeNull();
    expect(nextMilestone([card([milestone("done", null, 100)])], [], today)).toBeNull();
  });
  it("chooses the smallest amount remaining across cards even with a later deadline and lower percentage", () => {
    const nearDeadline = card([milestone("early", "2026-11-20", 100000)], 90000);
    const nearTarget = { ...card([milestone("closest", "2026-12-31", 10000)], 8000), id: "card-b" };
    const result = nextMilestone([nearDeadline, nearTarget], [], today);
    expect(result?.card.id).toBe("card-b");
    expect(result?.state.id).toBe("closest");
    expect(result?.state.remaining).toBe(2000);
    expect(result?.state.progress).toBe(0.8);
  });
  it("allows a closer undated target ahead of a dated target", () => {
    const result = nextMilestone([card([milestone("dated", "2026-11-20"), milestone("undated", null, 2000)])], [], today);
    expect(result?.state.id).toBe("undated");
  });
  it("excludes card loan EMIs from eligible spending", () => {
    const loan = { id: "loan", name: "Card loan", type: "card", cardId: "card-a", outstanding: 20000, asOf: today, confirmedOn: today, ratePct: 0, emi: 1000, monthsLeft: 20, emiDay: 10, billDay: 1, firstEmi: "2026-01-10", principal: 30000, takenOn: null, totalEmis: null, foreclosurePct: null, foreclosureGst: false, payments: [], goal: null } as Loan;
    const result = nextMilestone([card([milestone("target", null)], 2000)], [loan], today);
    expect(result?.state.spentNow).toBe(1000);
    expect(result?.state.remaining).toBe(9000);
  });
});
