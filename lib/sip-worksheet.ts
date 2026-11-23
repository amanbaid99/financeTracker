// Editable goal/vehicle allocations share the same funding calculation as confirmation.
import {
  hybridPlan,
  hybridMoneyPlan,
  hybridVehicles,
  type HybridPlanInput,
} from "./hybrid-plan";
import { goalFirstCandidates, sipPlan } from "./sip-plan";
import { categoryLabel } from "./categories";
import type { MonthlyVehicle } from "./investment-plan";
export type VehicleOverrides = Record<string, Record<string, number>>;
export interface SipWorksheetInput extends HybridPlanInput {
  vehicleOverrides?: VehicleOverrides;
}
export interface WorksheetVehicle {
  key: string;
  label: string;
  amount: number;
  suggested: number;
  manual: boolean;
  held: boolean;
}
/** Only the goal currently being edited has an exact total. Older vehicle
 * choices remain floors, so automatic money can leave the lowest priority first. */
export function sipVehicleEdit(
  goalId: string,
  key: string,
  amount: number,
  currentAmount: number,
  currentGoalTotal: number,
  vehicleOverrides: VehicleOverrides,
  held: boolean,
) {
  const next = { ...vehicleOverrides };
  if (held) next[goalId] = { ...next[goalId], [key]: amount };
  else delete next[goalId];
  return {
    overrides: { [goalId]: Math.max(0, currentGoalTotal + amount - currentAmount) },
    vehicleOverrides: next,
  };
}
export function sipWorksheetBaseline(input: SipWorksheetInput) {
  const baselineInput = {
    ...input,
    overrides: {},
    vehicleOverrides: undefined,
    fixedByGoal: undefined,
    minimums: {},
    exactHoldings: false,
  };
  const baseline = hybridPlan(baselineInput);
  baseline.vehicles = hybridVehicles(baselineInput, baseline);
  return baseline;
}
export function sipWorksheet(
  input: SipWorksheetInput,
  cachedBaseline?: ReturnType<typeof sipWorksheetBaseline>,
) {
  const baseline = cachedBaseline ?? sipWorksheetBaseline(input);
  const fixedByGoal = Object.fromEntries(
    Object.entries(input.vehicleOverrides ?? {}).map(([id, pins]) => [
      id,
      Object.values(pins).reduce((s, n) => s + n, 0),
    ]),
  );
  const effectiveOverrides = { ...input.overrides };
  for (const [id, total] of Object.entries(fixedByGoal))
    if (
      total >
        (baseline.goals.find((g) => g.goalId === id)?.requiredMonthly ?? 0) &&
      !Object.hasOwn(effectiveOverrides, id)
    )
      effectiveOverrides[id] = total;
  const result = hybridPlan({
    ...input,
    fixedByGoal,
    overrides: effectiveOverrides,
    allowOverfunding: true,
    minimums: {},
    exactHoldings: false,
  });
  const rows: Record<string, WorksheetVehicle[]> = {};
  const combined = new Map<string, MonthlyVehicle>();
  for (const [id, values] of Object.entries(input.vehicleOverrides ?? {})) {
    if (!result.goals.some((g) => g.goalId === id))
      throw Error("A goal no longer exists. Reload the planner.");
    for (const [key, n] of Object.entries(values)) {
      if (
        !key.startsWith("inv:") ||
        !input.investments.some(
          (i) => `inv:${i.id}` === key && !["fd", "epf"].includes(i.kind),
        )
      )
        throw Error("A chosen monthly investment is no longer available.");
      if (!Number.isSafeInteger(n) || n < 0 || n > 1e9)
        throw Error("Use whole-rupee vehicle amounts.");
    }
  }
  const suggestions = hybridMoneyPlan(
    { ...input, minimums: {} },
    result,
  ).suggestions;
  for (const goal of result.goals) {
    const original = input.goals.find((g) => g.id === goal.goalId)!;
    const pins = input.vehicleOverrides?.[goal.goalId] ?? {};
    const pinnedTotal = Object.values(pins).reduce((s, n) => s + n, 0);
    if (pinnedTotal > goal.recommendedMonthly)
      throw Error(
        `Vehicle amounts exceed ${goal.goalName}’s monthly total. Increase the goal amount or lower a vehicle.`,
      );
    const automatic = sipPlan(
      suggestions.map((s) =>
        s.goalId === goal.goalId
          ? { ...s, monthly: s.monthly - pinnedTotal }
          : s,
      ),
      input.investments.filter((i) => !Object.hasOwn(pins, `inv:${i.id}`)),
      result.links,
      "goal_first",
      input.goals,
    );
    const own = new Map<string, WorksheetVehicle>();
    const add = (key: string, label: string, amount: number, held: boolean) => {
      const before = own.get(key);
      own.set(key, {
        key,
        label,
        amount: (before?.amount ?? 0) + amount,
        suggested: 0,
        manual: Object.hasOwn(pins, key),
        held,
      });
    };
    for (const v of automatic)
      for (const p of v.parts.filter(
        (p) => p.goalId === goal.goalId && p.monthly > 0,
      ))
        add(v.key!, v.label, p.monthly, v.key!.startsWith("inv:"));
    for (const [key, n] of Object.entries(pins)) {
      const inv = input.investments.find((i) => `inv:${i.id}` === key)!;
      add(key, inv.name || categoryLabel(inv.category), n, true);
    }
    const linked = input.links
      .filter((l) => l.goalId === goal.goalId)
      .map((l) => l.investmentId);
    const candidates = goalFirstCandidates(
      goal.goalId,
      goal.investmentCategory,
      Math.max(goal.recommendedMonthly, linked.length * 1000, 1000),
      input.investments,
      input.links,
      original,
    );
    const preferred = candidates.map((i) => `inv:${i.id}`);
    for (const inv of input.investments.filter(
      (i) => linked.includes(i.id) && !["fd", "epf"].includes(i.kind),
    )) {
      const key = `inv:${inv.id}`;
      if (!own.has(key))
        add(key, inv.name || categoryLabel(inv.category), 0, true);
    }
    if (!own.size) {
      const key = `new:${goal.investmentCategory}:${goal.category === "essential" ? "safety" : "other"}`;
      add(key, categoryLabel(goal.investmentCategory), 0, false);
    }
    for (const row of own.values())
      row.suggested = (baseline.vehicles ?? [])
        .flatMap((v) =>
          v.key === row.key
            ? v.parts.filter((p) => p.goalId === goal.goalId)
            : [],
        )
        .reduce((s, p) => s + p.monthly, 0);
    rows[goal.goalId] = [...own.values()].sort((a, b) => {
      const rank = (r: WorksheetVehicle) =>
        preferred.includes(r.key)
          ? preferred.indexOf(r.key)
          : !r.held
            ? preferred.length
            : preferred.length + 1;
      return (
        rank(a) - rank(b) ||
        b.suggested - a.suggested ||
        a.key.localeCompare(b.key)
      );
    });
    if (
      rows[goal.goalId].reduce((s, r) => s + r.amount, 0) !==
      goal.recommendedMonthly
    )
      throw Error("Vehicle amounts do not match their goal total.");
    for (const row of rows[goal.goalId].filter((r) => r.amount > 0)) {
      const inv = input.investments.find((i) => `inv:${i.id}` === row.key);
      const aggregate = combined.get(row.key) ?? {
        key: row.key,
        label: row.label,
        current: inv?.monthlySip ?? 0,
        extra: 0,
        total: 0,
        parts: [],
      };
      aggregate.total += row.amount;
      aggregate.parts.push({
        goalId: goal.goalId,
        goalName: goal.goalName,
        monthly: row.amount,
        until: goal.targetDate,
        purpose:
          goal.category === "essential"
            ? "safety"
            : (goal.months ?? 0) >= 60
              ? "long_term"
              : "lifestyle",
      });
      combined.set(row.key, aggregate);
    }
  }
  result.vehicles = [...combined.values()];
  if (
    result.vehicles.reduce((s, v) => s + v.total, 0) !==
    result.totalMonthlyAllocated
  )
    throw Error("Investment totals do not match the monthly plan.");
  return { result, baseline, rows };
}
