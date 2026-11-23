import {
  calculateHybrid,
  type HybridInput,
  type HybridResult,
} from "./hybrid-engine";
import { categoryLabel } from "./categories";
import { sipPlan } from "./sip-plan";
import { readSipMinimums, type SipMinimums } from "./sip-minimums";
import { trackGoal } from "./tracker";
import type { MoneyPlan } from "./allocate";
import type { MonthlyVehicle } from "./investment-plan";
export interface HybridPlanInput extends HybridInput {
  minimums?: SipMinimums;
  exactHoldings?: boolean;
}
export function hybridPlan(input: HybridPlanInput): HybridResult {
  const minimums = readSipMinimums(input.minimums);
  if (Object.values(minimums).every((v) => v === 0))
    return calculateHybrid(input);
  if (
    Object.values(minimums).reduce((s, n) => s + n, 0) >
    (input.monthlyPlanLimit ?? input.monthlySavings)
  ) {
    const result = calculateHybrid({
      ...input,
      minimums: undefined,
    } as HybridInput);
    result.warnings.push(
      "Chosen holding minimums exceed current capacity and cannot all be funded. Review them before confirming.",
    );
    return result;
  }
  const base = calculateHybrid({ ...input, overrides: {} }),
    fixed: Record<string, number> = {};
  let outside = 0;
  for (const inv of [...input.investments].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const target = minimums[`inv:${inv.id}`] ?? 0;
    if (target <= 0) continue;
    let used = 0;
    for (const link of base.links.filter((l) => l.investmentId === inv.id)) {
      const g = base.goals.find((g) => g.goalId === link.goalId)!;
      const amount = Math.min(
        Math.floor((target * link.percent) / 100),
        Math.max(0, g.requiredMonthly - (fixed[g.goalId] ?? 0)),
      );
      fixed[g.goalId] = (fixed[g.goalId] ?? 0) + amount;
      used += amount;
    }
    outside += target - used;
  }
  return calculateHybrid({
    ...input,
    fixedByGoal: fixed,
    reservedOutsideGoals: outside,
  });
}
/** Adapt into existing vehicle selection instead of introducing another product picker. */
export function hybridMoneyPlan(
  input: HybridPlanInput,
  result = hybridPlan(input),
): MoneyPlan {
  const suggestions = result.goals
    .filter((g) => g.recommendedMonthly > 0 || g.oneTimeAllocated > 0)
    .map((g) => {
      const original = input.goals.find((x) => x.id === g.goalId)!;
      const after = {
        ...trackGoal(original, input.investments, result.links, input.today),
        funding: g,
        projected: g.projectedCorpus,
        futureTarget: g.targetCorpus,
        extraSipNeeded: g.monthlyShortfall,
      };
      return {
        goalId: g.goalId,
        goalName: g.goalName,
        lump: g.oneTimeAllocated,
        monthly: g.recommendedMonthly,
        category: g.investmentCategory,
        categoryLabel: categoryLabel(g.investmentCategory),
        why: g.explanation,
        after,
        stage: "ranked" as const,
      };
    });
  return {
    hybrid: result,
    minimums: readSipMinimums(input.minimums),
    reservedMonthly: 0,
    lump: input.oneTime ?? 0,
    monthlyTotal: input.monthlyPlanLimit ?? input.monthlySavings,
    sipsNow: input.investments.reduce((s, i) => s + i.monthlySip, 0),
    monthlyFree: input.monthlySavings,
    suggestions,
    leftoverLump: result.unallocatedOneTime,
    leftoverMonthly: result.unallocatedSavings,
    stillShortMonthly: result.monthlyContributionShortfall,
  };
}
export function hybridVehicles(
  input: HybridPlanInput,
  calculated?: HybridResult,
): MonthlyVehicle[] {
  if (input.exactHoldings)
    return exactVehicles(input, calculated ?? hybridPlan(input));
  const plan = hybridMoneyPlan(input, calculated),
    result = plan.hybrid!,
    rows: MonthlyVehicle[] = [],
    protectedParts = new Map<string, number>();
  for (const line of sipPlan(
    plan.suggestions,
    input.investments,
    result.links,
    "pooled",
    input.goals,
  ))
    rows.push({
      key: line.key ?? `new:${line.category}`,
      label: line.label,
      current: line.investment?.monthlySip ?? 0,
      extra: 0,
      total: line.monthly,
      parts: line.parts.map((p) => ({
        ...p,
        purpose:
          result.goals.find((g) => g.goalId === p.goalId)?.category ===
          "essential"
            ? "safety"
            : (result.goals.find((g) => g.goalId === p.goalId)?.months ?? 0) >=
                60
              ? "long_term"
              : "lifestyle",
      })),
    });
  // Explicit holding minimums are total destination floors, not extra SIPs.
  // Move their mapped goal contributions from the automatic picker to the chosen holding.
  for (const inv of [...input.investments].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const target = input.minimums?.[`inv:${inv.id}`] ?? 0;
    if (target <= 0) continue;
    let own = rows.find((r) => r.key === `inv:${inv.id}`);
    if (!own) {
      own = {
        key: `inv:${inv.id}`,
        label: inv.name || categoryLabel(inv.category),
        current: inv.monthlySip,
        extra: 0,
        total: 0,
        parts: [],
        fixed: true,
      };
      rows.push(own);
    }
    let moved = 0;
    for (const link of result.links.filter((l) => l.investmentId === inv.id)) {
      const goal = result.goals.find((g) => g.goalId === link.goalId)!;
      let wanted = Math.min(
        Math.floor((target * link.percent) / 100),
        goal.recommendedMonthly,
      );
      const already = own.parts
        .filter((p) => p.goalId === goal.goalId)
        .reduce((s, p) => s + p.monthly, 0);
      const keep = Math.min(wanted, already);
      moved += keep;
      wanted -= keep;
      protectedParts.set(`${own.key}:${goal.goalId}`, keep);
      for (const row of rows.filter((r) => r !== own)) {
        for (const part of row.parts.filter((p) => p.goalId === goal.goalId)) {
          const take = Math.min(
            wanted,
            Math.max(
              0,
              part.monthly -
                (protectedParts.get(`${row.key}:${goal.goalId}`) ?? 0),
            ),
          );
          if (take <= 0) continue;
          part.monthly -= take;
          row.total -= take;
          own.total += take;
          own.parts.push({ ...part, monthly: take });
          moved += take;
          wanted -= take;
          protectedParts.set(
            `${own.key}:${goal.goalId}`,
            (protectedParts.get(`${own.key}:${goal.goalId}`) ?? 0) + take,
          );
        }
      }
    }
    const outside = Math.max(0, target - moved);
    own.total += outside;
  }
  return rows
    .filter((r) => r.total > 0)
    .map((r) => ({ ...r, parts: r.parts.filter((p) => p.monthly > 0) }));
}
export function snapshotCompatible(raw: unknown): raw is HybridResult {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as HybridResult;
  return (
    typeof r.engineVersion === "string" &&
    r.engineVersion.startsWith("hybrid-") &&
    r.strategy === "hybrid" &&
    typeof r.availableMonthlySavings === "number" &&
    typeof r.policy?.atRiskMonthlyIncreasePct === "number" &&
    Array.isArray(r.links) &&
    Array.isArray(r.unallocatedInvestments) &&
    Array.isArray(r.warnings) &&
    Array.isArray(r.goals) &&
    r.goals.every(
      (g) =>
        typeof g.goalId === "string" &&
        typeof g.goalName === "string" &&
        typeof g.requiredMonthly === "number" &&
        typeof g.recommendedMonthly === "number" &&
        typeof g.projectedCorpus === "number" &&
        typeof g.targetCorpus === "number" &&
        Array.isArray(g.warnings) &&
        !!g.assumptions &&
        !!g.alternatives &&
        ["fully_funded", "on_track", "at_risk", "underfunded"].includes(
          g.status,
        ),
    )
  );
}

/** User-edited destinations are exact; automatic contributions use other vehicles. */
function exactVehicles(
  input: HybridPlanInput,
  result: HybridResult,
): MonthlyVehicle[] {
  const chosen = readSipMinimums(input.minimums);
  if (
    Object.values(chosen).reduce((sum, n) => sum + n, 0) >
    (input.monthlyPlanLimit ?? input.monthlySavings)
  )
    throw new Error("Your chosen holding amounts exceed the monthly plan.");
  const pinned = new Set(Object.keys(chosen).map((k) => k.slice(4)));
  const fixedByGoal: Record<string, number> = {};
  const manual: MonthlyVehicle[] = [];
  for (const inv of [...input.investments].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (!pinned.has(inv.id)) continue;
    const total = chosen[`inv:${inv.id}`];
    const parts: MonthlyVehicle["parts"] = [];
    for (const link of result.links.filter((l) => l.investmentId === inv.id)) {
      const goal = result.goals.find((g) => g.goalId === link.goalId)!;
      const monthly = Math.min(
        Math.floor((total * link.percent) / 100),
        Math.max(0, goal.requiredMonthly - (fixedByGoal[goal.goalId] ?? 0)),
      );
      fixedByGoal[goal.goalId] = (fixedByGoal[goal.goalId] ?? 0) + monthly;
      if (monthly > 0)
        parts.push({
          goalId: goal.goalId,
          goalName: goal.goalName,
          monthly,
          until: goal.targetDate,
          purpose:
            goal.category === "essential"
              ? "safety"
              : (goal.months ?? 0) >= 60
                ? "long_term"
                : "lifestyle",
        });
    }
    if (total > 0)
      manual.push({
        key: `inv:${inv.id}`,
        label: inv.name || categoryLabel(inv.category),
        current: inv.monthlySip,
        extra: 0,
        total,
        parts,
        fixed: true,
      });
  }
  const plan = hybridMoneyPlan(input, result);
  const suggestions = plan.suggestions
    .map((s) => ({
      ...s,
      monthly: Math.max(0, s.monthly - (fixedByGoal[s.goalId] ?? 0)),
    }))
    .filter((s) => s.monthly > 0 || s.lump > 0);
  const automatic = sipPlan(
    suggestions,
    input.investments.filter((i) => !pinned.has(i.id)),
    result.links,
    "pooled",
    input.goals,
  ).map((line) => ({
    key: line.key ?? `new:${line.category}`,
    label: line.label,
    current: line.investment?.monthlySip ?? 0,
    extra: 0,
    total: line.monthly,
    parts: line.parts.map((p) => ({
      ...p,
      purpose: (result.goals.find((g) => g.goalId === p.goalId)?.category ===
      "essential"
        ? "safety"
        : (result.goals.find((g) => g.goalId === p.goalId)?.months ?? 0) >= 60
          ? "long_term"
          : "lifestyle") as "safety" | "long_term" | "lifestyle",
    })),
  }));
  return [...automatic, ...manual].filter((r) => r.total > 0);
}
