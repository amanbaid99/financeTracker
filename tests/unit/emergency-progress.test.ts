import { expect, it } from "vitest";
import {
  emergencyProgress,
  withEmergencyTarget,
} from "@/lib/emergency-progress";
import { retirementCorpusToday } from "@/lib/retirement-needs";
it("rounds costs up and shows ordered milestones against the same assigned savings", () => {
  const p = emergencyProgress(40000, 68015)!;
  expect(p.roundedMonthly).toBe(70000);
  expect(p.stages.map((s) => [s.months, s.target])).toEqual([
    [1, 70000],
    [3, 210000],
    [6, 420000],
    [12, 840000],
    [24, 1680000],
  ]);
  expect(p.stages.map((s) => s.saved)).toEqual(Array(5).fill(40000));
  expect(p.stages.filter((s) => s.stretch).map((s) => s.months)).toEqual([
    12, 24,
  ]);
  expect(p.stages[0].progress).toBeCloseTo(4 / 7);
  expect(
    emergencyProgress(210000, 68015)!.stages.find((s) => !s.reached)?.months,
  ).toBe(6);
  expect(
    emergencyProgress(2000000, 70000)!.stages.every((s) => s.progress === 1),
  ).toBe(true);
  expect(emergencyProgress(40000, 0)).toBeNull();
  expect(emergencyProgress(40000, 70000)!.roundedMonthly).toBe(70000);
});
it("prices finite retirement spending in today's money without applying pre-retirement inflation twice", () => {
  expect(retirementCorpusToday(100000, 20, 6, 5)).toBe(26415298);
  expect(retirementCorpusToday(100000, 15, 6, 5)).toBe(19334858);
  expect(retirementCorpusToday(100000, 20, 6, 6)).toBe(24000000);
  expect(retirementCorpusToday(100000, 20, 0, 0)).toBe(24000000);
});

it("updates the linked main target when fixed expenses rise or fall without altering manual goals", () => {
  const goal = {
    type: "emergency_fund",
    target: 450000,
    emergencyTargetMonths: 6,
  };
  expect(withEmergencyTarget(goal, 68015).target).toBe(420000);
  expect(withEmergencyTarget(goal, 71000).target).toBe(480000);
  expect(withEmergencyTarget(goal, 53000).target).toBe(360000);
  expect(withEmergencyTarget(goal, 0).target).toBe(450000);
  expect(
    withEmergencyTarget({ type: "emergency_fund", target: 450000 }, 68015)
      .target,
  ).toBe(450000);
  expect(goal.target).toBe(450000);
});
