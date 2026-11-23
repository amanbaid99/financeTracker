import { ASSUME_HOLDINGS_WITHDRAWABLE } from "./holding-access";
// A read-only withdrawal preview. No redemption or assumption about tax lots.
import { calculateHybrid } from "./hybrid-engine";
import { autoAllocate } from "./auto-allocate";
import { assetClassOf } from "./portfolio";
import { trackGoal, type Investment, type TrackedGoal } from "./tracker";

export interface WithdrawalLine {
  investmentId: string;
  amount: number;
  remaining: number;
  reason: "unassigned" | "selected_goal" | "other_goals";
}
export interface WithdrawalImpact {
  goalId: string;
  before: number;
  after: number;
  extraShortfall: number;
}
export interface WithdrawalPlan {
  requested: number;
  available: number;
  short: number;
  lines: WithdrawalLine[];
  impacts: WithdrawalImpact[];
  excluded: number;
}
export function withdrawalEligible(i: Investment): boolean {
  if (ASSUME_HOLDINGS_WITHDRAWABLE)
    return Number.isFinite(i.value) && i.value > 0;
  if (i.availability && i.availability !== "available") return false;
  if (i.value <= 0 || !Number.isFinite(i.value)) return false;
  // No maturity or purchase-lot dates are recorded. Never assume locked assets are available.
  if (i.category === "elss") return false;
  return (
    i.kind === "savings" ||
    (i.kind === "mutual_fund" && assetClassOf(i) !== "other") ||
    (i.kind === "stock" && assetClassOf(i) !== "other")
  );
}
export function planWithdrawal(opts: {
  amount: number;
  investmentId?: string | null;
  goalId?: string | null;
  allowOtherGoals?: boolean;
  allowEmergencyReserve?: boolean;
  goals: TrackedGoal[];
  investments: Investment[];
  today: string;
}): WithdrawalPlan {
  const { amount, goals, investments, today } = opts;
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1e9)
    throw new Error(
      "Enter a positive whole-rupee amount up to ₹1,00,00,00,000.",
    );
  if (opts.goalId && !goals.some((g) => g.id === opts.goalId))
    throw new Error("Choose a current goal.");
  const bare = goals.map((g) => trackGoal(g, investments, [], today));
  const pinned = goals.flatMap((g) =>
    g.lines.map((l) => ({
      goalId: g.id,
      investmentId: l.investment.id,
      percent: l.percent,
    })),
  );
  const usePinned = goals.some((g) => g.confirmedMapping);
  const coverage = (holdings: Investment[]) => {
    const result = calculateHybrid({
      today,
      goals,
      investments: holdings,
      links: pinned,
      monthlySavings: 0,
    });
    return {
      links: result.links,
      covers: Object.fromEntries(
        result.goals.map((g) => [g.goalId, { short: g.fundingGap }]),
      ),
    };
  };
  const before = usePinned
    ? coverage(investments)
    : autoAllocate(bare, investments, today);
  type Slice = {
    investment: Investment;
    amount: number;
    tier: number;
    reason: WithdrawalLine["reason"];
  };
  const slices: Slice[] = [];
  for (const inv of investments.filter(
    (i) =>
      withdrawalEligible(i) &&
      (ASSUME_HOLDINGS_WITHDRAWABLE ||
        !i.accessibleOn ||
        i.accessibleOn <= today) &&
      (!opts.investmentId || i.id === opts.investmentId),
  )) {
    const allocations = before.links
      .filter((l) => l.investmentId === inv.id)
      .map((l) => ({
        goal: goals.find((g) => g.id === l.goalId)!,
        amount: (inv.value * l.percent) / 100,
      }));
    const used = allocations.reduce((sum, a) => sum + a.amount, 0);
    const free = Math.max(0, Math.floor(inv.value - used));
    if (free > 0)
      slices.push({
        investment: inv,
        amount: free,
        tier: 1,
        reason: "unassigned",
      });
    let selected = allocations
      .filter((a) => a.goal?.id === opts.goalId)
      .reduce((sum, a) => sum + a.amount, 0);
    const selectedGoal = goals.find((g) => g.id === opts.goalId);
    if (selectedGoal?.emergencyReserve && !opts.allowEmergencyReserve) {
      const eligibleIds = new Set(
        investments
          .filter(
            (i) =>
              withdrawalEligible(i) &&
              (ASSUME_HOLDINGS_WITHDRAWABLE ||
                !i.accessibleOn ||
                i.accessibleOn <= today),
          )
          .map((i) => i.id),
      );
      const total = before.links
        .filter(
          (l) =>
            l.goalId === selectedGoal.id && eligibleIds.has(l.investmentId),
        )
        .reduce(
          (sum, l) =>
            sum +
            (investments.find((i) => i.id === l.investmentId)!.value *
              l.percent) /
              100,
          0,
        );
      const protectedShare =
        total > 0
          ? Math.ceil(
              (Math.min(total, selectedGoal.emergencyReserve) * selected) /
                total,
            )
          : 0;
      selected = Math.max(0, selected - protectedShare);
    }
    if (selected >= 1)
      slices.push({
        investment: inv,
        amount: Math.floor(selected),
        tier: 0,
        reason: "selected_goal",
      });
    // Other-goal permission cannot consume emergency or bill reserves.
    if (opts.allowOtherGoals) {
      const other = allocations
        .filter(
          (a) =>
            a.goal &&
            a.goal.id !== opts.goalId &&
            !["emergency_fund", "bills_fund"].includes(a.goal.type),
        )
        .reduce((sum, a) => sum + a.amount, 0);
      if (other >= 1)
        slices.push({
          investment: inv,
          amount: Math.floor(other),
          tier: 2,
          reason: "other_goals",
        });
    }
  }
  const risk = (i: Investment) =>
    i.kind === "savings"
      ? 0
      : ["liquid_fund", "overnight_fund"].includes(i.category ?? "")
        ? 1
        : assetClassOf(i) === "debt"
          ? 2
          : 3;
  slices.sort(
    (a, b) =>
      a.tier - b.tier ||
      risk(a.investment) - risk(b.investment) ||
      b.amount - a.amount ||
      a.investment.id.localeCompare(b.investment.id),
  );
  let left = amount;
  const lines: WithdrawalLine[] = [];
  const taken = new Map<string, number>();
  for (const slice of slices) {
    if (left <= 0) break;
    const inv = slice.investment;
    const remaining = Math.max(
      0,
      Math.floor(inv.value) - (taken.get(inv.id) ?? 0),
    );
    const take = Math.min(left, slice.amount, remaining);
    if (take <= 0) continue;
    left -= take;
    taken.set(inv.id, (taken.get(inv.id) ?? 0) + take);
    lines.push({
      investmentId: inv.id,
      amount: take,
      remaining: remaining - take,
      reason: slice.reason,
    });
  }
  const afterInvestments = investments.map((i) => ({
    ...i,
    value: Math.max(0, i.value - (taken.get(i.id) ?? 0)),
  }));
  const after = usePinned
    ? coverage(afterInvestments)
    : autoAllocate(
        goals.map((g) => trackGoal(g, afterInvestments, [], today)),
        afterInvestments,
        today,
      );
  const impacts = goals
    .map((g) => ({
      goalId: g.id,
      before: before.covers[g.id]?.short ?? 0,
      after: after.covers[g.id]?.short ?? 0,
      extraShortfall: Math.max(
        0,
        (after.covers[g.id]?.short ?? 0) - (before.covers[g.id]?.short ?? 0),
      ),
    }))
    .filter((g) => g.extraShortfall > 0);
  return {
    requested: amount,
    available: amount - left,
    short: left,
    lines,
    impacts,
    excluded: investments.filter((i) => i.value > 0 && !withdrawalEligible(i))
      .length,
  };
}
