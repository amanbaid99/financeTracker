// One deterministic funding and allocation calculation. Decimal arithmetic, integer INR outputs.
// No database, clock, AI or mutation of supplied goals/holdings.
import Decimal from "decimal.js-light";
import { addMonths, monthsBetween } from "./dates";
import { categoryForHorizon } from "./allocate";
import { defaultReturn } from "./instruments";
import { hybridBillsForecast } from "./bills-fund";
import { assetClassOf } from "./portfolio";
import {
  trackGoal,
  type GoalInput,
  type Investment,
  type Link,
} from "./tracker";
import {
  FinancialDecimal as D,
  growth,
  futureValueDecimal,
  requiredMonthlyDecimal,
} from "./funding-math";
export const HYBRID_VERSION = "hybrid-1.0.0";
export interface HybridPolicy {
  priority: Record<"high" | "medium" | "low", number>;
  urgency: [number, number, number];
  returns: [number, number, number, number];
  atRiskMonthlyIncreasePct: number;
  staleDays: number;
  emergencyBuildMonths: number;
  maxExtensionMonths: number;
}
export const DEFAULT_HYBRID_POLICY: HybridPolicy = {
  priority: { high: 3, medium: 2, low: 1 },
  urgency: [1.5, 1.25, 1],
  returns: [4, 6, 7, 9],
  atRiskMonthlyIncreasePct: 10,
  staleDays: 45,
  emergencyBuildMonths: 12,
  maxExtensionMonths: 600,
};
export type FundingStatus =
  "fully_funded" | "on_track" | "at_risk" | "underfunded";
export interface HybridGoal {
  goalId: string;
  goalName: string;
  priority: "high" | "medium" | "low";
  category: "essential" | "flexible";
  months: number | null;
  targetDate: string | null;
  targetCorpus: number;
  existingCoverage: number;
  projectedExistingCorpus: number;
  fundingGap: number;
  requiredMonthly: number;
  minimumMonthly: number;
  effectiveMinimumMonthly: number;
  recommendedMonthly: number;
  monthlyShortfall: number;
  projectedCorpus: number;
  projectedShortfall: number;
  projectedSurplus: number;
  minimumShortfall: number;
  oneTimeAllocated: number;
  currentMonthly: number;
  immediateShortfall: number;
  status: FundingStatus;
  needsDate: boolean;
  recommendedInvestmentClass: string;
  investmentCategory: string;
  explanation: string;
  warnings: string[];
  assumptions: {
    annualReturnPct: number;
    inflationPct: number;
    targetType: string;
    contributionTiming: string;
    existingInvestmentReturns: {
      investmentId: string;
      annualReturnPct: number;
      source: string;
    }[];
    emergencyBuildMonths?: number;
  };
  alternatives: {
    additionalMonthly: number;
    revisedDeadline: string | null;
    achievableTarget: number;
    achievableTargetInOriginalBasis: number;
  };
}
export interface HybridResult {
  vehicles?: import("./investment-plan").MonthlyVehicle[];
  strategy: "hybrid";
  riskTolerance: "conservative" | "moderate" | "aggressive" | null;
  engineVersion: string;
  calculatedOn: string;
  policy: HybridPolicy;
  availableMonthlySavings: number;
  monthlyPlanLimit: number;
  budgetDeficit: number;
  reservedOutsideGoals: number;
  totalMonthlyRequired: number;
  totalMonthlyAllocated: number;
  unallocatedSavings: number;
  monthlyContributionShortfall: number;
  immediateFundingShortfall: number;
  oneTimeAllocated: number;
  unallocatedOneTime: number;
  goals: HybridGoal[];
  links: Link[];
  unallocatedInvestments: { investmentId: string; value: number }[];
  warnings: string[];
}
export interface HybridInput {
  today: string;
  goals: GoalInput[];
  investments: Investment[];
  links: Link[];
  riskTolerance?: "conservative" | "moderate" | "aggressive" | null;
  monthlySavings: number;
  monthlyPlanLimit?: number;
  budgetDeficit?: number;
  oneTime?: number;
  fixedByGoal?: Record<string, number>;
  reservedOutsideGoals?: number;
  overrides?: Record<string, number>;
  policy?: Partial<HybridPolicy>;
}
const integer = (n: Decimal | number | string) => {
  const value = new D(n).toDecimalPlaces(0, D.ROUND_FLOOR).toNumber();
  if (!Number.isSafeInteger(value))
    throw Error(
      "This projection exceeds the supported money range. Review the date or return assumption.",
    );
  return value;
};
const up = (n: Decimal) =>
  n.greaterThan(0) ? integer(n.toDecimalPlaces(0, D.ROUND_CEIL)) : 0;
function money(n: number) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 1e13)
    throw Error(
      "Use non-negative whole-rupee amounts within the supported limit.",
    );
  return n;
}
export function endMonthValue(
  corpus: number,
  monthly: number,
  rate: number,
  months: number,
): number {
  return integer(futureValueDecimal(corpus, monthly, rate, months));
}
export function endMonthRequirement(
  target: number,
  corpus: number,
  rate: number,
  months: number,
): number {
  return up(requiredMonthlyDecimal(target, corpus, rate, months));
}
export function monthlyCapacity(
  income: number,
  expenses: number,
  debtPayments: number,
  cashBuffer = 0,
) {
  for (const value of [income, expenses, debtPayments, cashBuffer])
    money(value);
  const raw = new D(income)
    .minus(expenses)
    .minus(debtPayments)
    .minus(cashBuffer)
    .toNumber();
  return {
    availableSavings: Math.max(0, raw),
    budgetDeficit: Math.max(0, -raw),
  };
}
/** Validate proportional ownership, with no double counting and deterministic ordering. */
export function checkedGoalLinks(
  goals: GoalInput[],
  investments: Investment[],
  links: Link[],
): Link[] {
  const goalIds = new Set(goals.filter((g) => !g.completed).map((g) => g.id)),
    ids = new Set(investments.map((i) => i.id)),
    totals = new Map<string, number>(),
    pairs = new Set<string>();
  return links
    .filter((l) => goalIds.has(l.goalId) && ids.has(l.investmentId))
    .map((l) => {
      const bp = new D(l.percent).times(100);
      if (!bp.isInteger() || bp.lessThanOrEqualTo(0) || bp.greaterThan(10000))
        throw Error(
          "Allocation percentages must use at most two decimal places and total at most 100%.",
        );
      const key = `${l.goalId}:${l.investmentId}`;
      if (pairs.has(key)) throw Error("Duplicate goal ownership.");
      pairs.add(key);
      const total = (totals.get(l.investmentId) ?? 0) + bp.toNumber();
      if (total > 10000)
        throw Error("An investment cannot be allocated more than once.");
      totals.set(l.investmentId, total);
      return { ...l };
    })
    .sort(
      (a, b) =>
        a.goalId.localeCompare(b.goalId) ||
        a.investmentId.localeCompare(b.investmentId),
    );
}
export function unallocatedLiquidValue(
  investments: Investment[],
  links: Link[],
  today: string,
) {
  return investments
    .filter(
      (i) =>
        (!i.availability || i.availability === "available") &&
        (!i.accessibleOn || i.accessibleOn <= today) &&
        (i.kind === "savings" ||
          (i.kind === "mutual_fund" &&
            [
              "liquid_fund",
              "overnight_fund",
              "money_market",
              "arbitrage",
            ].includes(i.category ?? ""))),
    )
    .reduce((sum, i) => {
      const used = links
        .filter((l) => l.investmentId === i.id)
        .reduce((n, l) => n.plus(l.percent), new D(0));
      return (
        sum + integer(new D(i.value).times(new D(100).minus(used)).div(100))
      );
    }, 0);
}
function accessible(i: Investment, g: GoalInput, today: string) {
  if (i.availability === "pledged" || i.availability === "unavailable")
    return false;
  if (i.accessibleOn && (!g.targetDate || i.accessibleOn > g.targetDate))
    return false;
  if (i.availability === "locked" && !i.accessibleOn) return false;
  if (
    ["ppf", "epf", "nps"].includes(i.kind) &&
    g.type !== "retirement" &&
    !i.accessibleOn
  )
    return false;
  if (i.category === "elss" && !i.accessibleOn) return false;
  if (
    i.kind === "fd" &&
    !i.accessibleOn &&
    (["emergency_fund", "bills_fund"].includes(g.type) ||
      (g.targetDate && monthsBetween(today, g.targetDate) < 12))
  )
    return false;
  return true;
}
function essentialOrder(a: GoalInput, b: GoalInput) {
  return (
    (a.planRank ?? 999) - (b.planRank ?? 999) ||
    (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999") ||
    a.id.localeCompare(b.id)
  );
}
/** Capped water filling with integer remainders; input order never breaks a tie. */
export function weightedAllocate(
  total: number,
  items: { id: string; cap: number; weight: Decimal }[],
): Record<string, number> {
  let left = money(total);
  const out: Record<string, number> = {};
  let active = items
    .filter((x) => x.cap > 0 && x.weight.greaterThan(0))
    .sort((a, b) => a.id.localeCompare(b.id));
  while (left > 0 && active.length) {
    const weights = active.reduce((s, x) => s.plus(x.weight), new D(0));
    const capped = active.filter((x) =>
      new D(left)
        .times(x.weight)
        .div(weights)
        .greaterThanOrEqualTo(x.cap - (out[x.id] ?? 0)),
    );
    if (capped.length) {
      for (const x of capped) {
        const n = x.cap - (out[x.id] ?? 0);
        out[x.id] = (out[x.id] ?? 0) + n;
        left -= n;
      }
      const ids = new Set(capped.map((x) => x.id));
      active = active.filter((x) => !ids.has(x.id));
      continue;
    }
    const shares = active.map((x) => {
      const exact = new D(left).times(x.weight).div(weights),
        n = Math.min(x.cap - (out[x.id] ?? 0), integer(exact));
      return { x, n, fraction: exact.minus(n) };
    });
    for (const { x, n } of shares) {
      out[x.id] = (out[x.id] ?? 0) + n;
      left -= n;
    }
    shares.sort(
      (a, b) =>
        b.fraction.comparedTo(a.fraction) || a.x.id.localeCompare(b.x.id),
    );
    for (const { x } of shares) {
      if (left <= 0) break;
      if ((out[x.id] ?? 0) < x.cap) {
        out[x.id] = (out[x.id] ?? 0) + 1;
        left--;
      }
    }
    break;
  }
  return out;
}
export function hybridCategory(months: number | null, type: string) {
  return categoryForHorizon(
    months === null ? 0 : months === 36 ? 35 : months === 60 ? 59 : months,
    type,
  );
}
export function calculateHybrid(input: HybridInput): HybridResult {
  const policy: HybridPolicy = {
    ...DEFAULT_HYBRID_POLICY,
    ...input.policy,
    priority: { ...DEFAULT_HYBRID_POLICY.priority, ...input.policy?.priority },
    urgency: [...(input.policy?.urgency ?? DEFAULT_HYBRID_POLICY.urgency)],
    returns: [...(input.policy?.returns ?? DEFAULT_HYBRID_POLICY.returns)],
  };
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.today) ||
    Number.isNaN(Date.parse(input.today))
  )
    throw Error("Pass a valid calculation date.");
  for (const n of [...Object.values(policy.priority), ...policy.urgency])
    if (!Number.isFinite(n) || n <= 0) throw Error("Weights must be positive.");
  if (
    policy.atRiskMonthlyIncreasePct < 0 ||
    policy.staleDays < 0 ||
    policy.emergencyBuildMonths < 1 ||
    policy.maxExtensionMonths > 1200
  )
    throw Error("Invalid planning policy.");
  const budget = money(input.monthlySavings),
    planLimit = Math.min(budget, money(input.monthlyPlanLimit ?? budget)),
    oneTime = money(input.oneTime ?? 0);
  if (
    new Set(input.goals.map((g) => g.id)).size !== input.goals.length ||
    new Set(input.investments.map((i) => i.id)).size !==
      input.investments.length
  )
    throw Error("Duplicate goal or investment ID.");
  input.investments.forEach((i) => {
    money(i.value);
    money(i.monthlySip);
    if (
      i.units !== undefined &&
      i.units !== null &&
      (!Number.isFinite(i.units) || i.units < 0)
    )
      throw Error("Invalid units.");
  });
  const links = checkedGoalLinks(input.goals, input.investments, input.links);
  const source = [...input.goals].sort((a, b) => a.id.localeCompare(b.id));
  const rows: HybridGoal[] = source.map((g) => {
    money(g.target);
    money(g.minimumMonthly ?? 0);
    const category =
      g.goalCategory ??
      (["emergency_fund", "bills_fund", "loan_payoff"].includes(g.type)
        ? "essential"
        : "flexible");
    const priority = g.priorityLevel ?? (g.niceToHave ? "low" : "medium");
    const actualMonths = g.targetDate
      ? monthsBetween(input.today, g.targetDate)
      : null;
    const months =
      g.type === "bills_fund"
        ? 12
        : (actualMonths ??
          (g.type === "emergency_fund" ? policy.emergencyBuildMonths : null));
    const needsDate = months === null;
    const defaultRate =
      policy.returns[
        months === null || months <= 12
          ? 0
          : months <= 36
            ? 1
            : months <= 60
              ? 2
              : input.riskTolerance === "aggressive"
                ? 3
                : input.riskTolerance === "conservative"
                  ? 1
                  : 2
      ];
    const rate =
      g.type === "bills_fund" ? 0 : (g.expectedReturnPct ?? defaultRate);
    growth(rate, 0);
    const inflation = g.targetType === "future" ? 0 : (g.inflationPct ?? 0);
    if (!Number.isFinite(inflation) || inflation < 0 || inflation > 30)
      throw Error("Inflation must be between 0% and 30%.");
    const loanProjection =
      g.type === "loan_payoff" && g.loan
        ? trackGoal(g, input.investments, links, input.today)
        : null;
    let target =
        loanProjection?.futureTarget ??
        up(new D(g.target).times(growth(inflation, months ?? 0))),
      coverage = new D(0),
      projected = new D(0),
      currentMonthly = new D(0);
    const warnings: string[] = [],
      existingInvestmentReturns: {
        investmentId: string;
        annualReturnPct: number;
        source: string;
      }[] = [];
    for (const l of links.filter((l) => l.goalId === g.id)) {
      const inv = input.investments.find((i) => i.id === l.investmentId)!;
      if (!accessible(inv, g, input.today)) {
        warnings.push(
          `Unavailable holding: ${inv.id}. Not counted toward coverage.`,
        );
        continue;
      }
      const part = new D(inv.value).times(l.percent).div(100);
      coverage = coverage.plus(part);
      const holdingRate =
        inv.returnPct ??
        Math.min(defaultReturn(inv.kind, inv.category), defaultRate);
      existingInvestmentReturns.push({
        investmentId: inv.id,
        annualReturnPct: holdingRate,
        source: inv.returnPct === null ? "conservative-default" : "user",
      });
      projected = projected.plus(part.times(growth(holdingRate, months ?? 0)));
      currentMonthly = currentMonthly.plus(
        new D(inv.monthlySip).times(l.percent).div(100),
      );
      if(["ppf","epf","nps"].includes(inv.kind)&&!inv.accessibleOn)warnings.push(`Confirm retirement access eligibility before the deadline: ${inv.id}.`);
      if(assetClassOf(inv)==="other")warnings.push(`Unclassified holding: ${inv.id}. Confirm its liquidity and valuation.`);
      if (!inv.valuationDate)
        warnings.push(
          `Valuation date missing: ${inv.id}. Using the recorded balance, not a live price.`,
        );
      else if (
        inv.valuationDate > input.today ||
        Date.parse(input.today) - Date.parse(inv.valuationDate) >
          policy.staleDays * 86400000
      )
        warnings.push(`Check valuation date: ${inv.id}.`);
      if (
        input.riskTolerance === "conservative" &&
        ["equity", "gold"].includes(assetClassOf(inv))
      )
        warnings.push(`Risk exceeds the conservative preference: ${inv.id}.`);
      if (
        months !== null &&
        months <= 36 &&
        ["equity", "gold"].includes(assetClassOf(inv))
      )
        warnings.push(`Risk may conflict with the deadline: ${inv.id}.`);
      if (inv.kind === "fd" && !inv.accessibleOn)
        warnings.push(`Confirm maturity or early access: ${inv.id}.`);
    }
    let required =
      months === null
        ? (g.minimumMonthly ?? 0)
        : endMonthRequirement(target, integer(coverage), rate, months);
    // Existing assets each grow at their own rate, never at the future contribution rate.
    let existing = integer(projected);
    const gap = Math.max(0, target - existing);
    if (months !== null && months > 0) {
      const r = growth(rate, 1).minus(1);
      required =
        gap === 0
          ? 0
          : up(
              r.isZero()
                ? new D(gap).div(months)
                : new D(gap).times(r).div(growth(rate, months).minus(1)),
            );
    }
    if (g.type === "bills_fund") {
      const bill = hybridBillsForecast(
        g.bills ?? [],
        integer(coverage),
        0,
        input.today,
      );
      target = bill.target;
      existing = integer(coverage);
      required = bill.requiredMonthly;
      warnings.push(
        "Recurring bills use actual payment dates and contributions after each full month. Returns are excluded from this cash-flow check.",
      );
      if (bill.immediateShortfall > 0)
        warnings.push(
          `Bills need cash before the first contribution: ₹${bill.immediateShortfall}.`,
        );
    }
    if (
      g.expectedReturnPct !== null &&
      g.expectedReturnPct !== undefined &&
      g.expectedReturnPct > defaultRate
    )
      warnings.push(
        "Your return assumption is above the conservative default for this horizon. It is preserved; review it before relying on the projection.",
      );
    if (!input.riskTolerance)
      warnings.push(
        "Risk preference is not provided. Future long-term contributions use balanced assumptions.",
      );
    if (needsDate)
      warnings.push(
        "Add a date for a deadline-based projection. Only an explicit monthly amount is planned.",
      );
    if (actualMonths === 0)
      warnings.push(
        g.targetDate! < input.today
          ? "Deadline has passed. No new monthly SIP can meet it."
          : "Due before the next full monthly contribution. Review immediate funding.",
      );
    if (loanProjection?.emisCloseFirst) {
      target = 0;
      required = 0;
      warnings.push(
        "Scheduled EMIs close the loan by its deadline. No additional investment is needed.",
      );
    }
    if (g.completed) {
      required = 0;
      warnings.push("Completed goal. No new funding recommended.");
    }
    if (g.type === "loan_payoff" && "emisCloseFirst" in g && g.emisCloseFirst)
      required = 0;
    const funded =
      g.type === "bills_fund"
        ? required === 0 &&
          hybridBillsForecast(g.bills ?? [], integer(coverage), 0, input.today)
            .cashflowShortfall === 0
        : existing >= target;
    let { category: investmentCategory } = hybridCategory(months, g.type);
    if (
      months !== null &&
      months > 60 &&
      g.type !== "bills_fund" &&
      g.type !== "emergency_fund"
    )
      investmentCategory =
        input.riskTolerance === "aggressive"
          ? "equity_index"
          : input.riskTolerance === "conservative"
            ? "short_debt_fund"
            : "balanced_advantage";
    return {
      goalId: g.id,
      goalName: g.name,
      priority,
      category,
      months,
      targetDate: g.targetDate,
      targetCorpus: target,
      existingCoverage: integer(coverage),
      projectedExistingCorpus: existing,
      fundingGap: Math.max(0, target - existing),
      requiredMonthly: funded || g.completed ? 0 : required,
      minimumMonthly: g.minimumMonthly ?? 0,
      effectiveMinimumMonthly: Math.min(required, g.minimumMonthly ?? 0),
      recommendedMonthly: 0,
      monthlyShortfall: 0,
      projectedCorpus: existing,
      projectedShortfall: Math.max(0, target - existing),
      projectedSurplus: Math.max(0, existing - target),
      minimumShortfall: 0,
      oneTimeAllocated: 0,
      currentMonthly: integer(currentMonthly),
      immediateShortfall: 0,
      status: funded || g.completed ? "fully_funded" : "underfunded",
      needsDate,
      recommendedInvestmentClass:
        months === null || months <= 12
          ? "liquid-capital-preservation"
          : months <= 36
            ? "capital-preservation"
            : months <= 60
              ? "balanced-conservative"
              : input.riskTolerance === "aggressive"
                ? "growth-subject-to-risk"
                : input.riskTolerance === "conservative"
                  ? "capital-preservation"
                  : "balanced-conservative",
      investmentCategory,
      explanation:
        category === "essential"
          ? "Essentials are funded first, by your ranking and then deadline."
          : `${priority} priority; ${months === null ? "no deadline" : `${months} months to plan`}. Remaining money is shared by priority, urgency and need.`,
      warnings,
      assumptions: {
        annualReturnPct: rate,
        inflationPct: inflation,
        targetType: g.targetType ?? "today",
        contributionTiming: "end_of_month",
        existingInvestmentReturns,
        ...(g.type === "emergency_fund" && !g.targetDate
          ? { emergencyBuildMonths: policy.emergencyBuildMonths }
          : {}),
      },
      alternatives: {
        additionalMonthly: 0,
        revisedDeadline: null,
        achievableTarget: existing,
        achievableTargetInOriginalBasis: existing,
      },
    };
  });
  let lumpLeft = oneTime;
  const ordered = [...rows].sort(
    (a, b) =>
      Number(b.category === "essential") - Number(a.category === "essential") ||
      essentialOrder(
        source.find((g) => g.id === a.goalId)!,
        source.find((g) => g.id === b.goalId)!,
      ),
  );
  for (const row of ordered) {
    if (row.status === "fully_funded" || lumpLeft <= 0) continue;
    const take = Math.min(
      lumpLeft,
      up(
        new D(row.fundingGap).div(
          growth(row.assumptions.annualReturnPct, row.months ?? 0),
        ),
      ),
    );
    row.oneTimeAllocated = take;
    lumpLeft -= take;
    if (
      row.months !== null &&
      row.months > 0 &&
      source.find((g) => g.id === row.goalId)?.type !== "bills_fund"
    ) {
      const gap = Math.max(
        0,
        row.targetCorpus -
          row.projectedExistingCorpus -
          endMonthValue(take, 0, row.assumptions.annualReturnPct, row.months),
      );
      row.requiredMonthly = endMonthRequirement(
        gap,
        0,
        row.assumptions.annualReturnPct,
        row.months,
      );
    }
    if (source.find((g) => g.id === row.goalId)?.type === "bills_fund")
      row.requiredMonthly = hybridBillsForecast(
        source.find((g) => g.id === row.goalId)!.bills ?? [],
        row.existingCoverage + take,
        0,
        input.today,
      ).requiredMonthly;
    row.effectiveMinimumMonthly = Math.min(
      row.minimumMonthly,
      row.requiredMonthly,
    );
  }
  let left = planLimit - money(input.reservedOutsideGoals ?? 0);
  for (const row of rows) {
    const fixed = Math.min(
      row.requiredMonthly,
      money(input.fixedByGoal?.[row.goalId] ?? 0),
    );
    row.recommendedMonthly = fixed;
    left -= fixed;
  }
  if (left < 0)
    throw Error("Chosen holding amounts exceed the available budget.");
  const ids = new Set(rows.map((r) => r.goalId));
  for (const [id, value] of Object.entries(input.overrides ?? {})) {
    if (!ids.has(id)) throw Error("An overridden goal no longer exists.");
    money(value);
    const row = rows.find((r) => r.goalId === id)!;
    if (value > row.requiredMonthly)
      throw Error("A goal allocation cannot exceed its monthly requirement.");
    if (value < row.recommendedMonthly)
      throw Error(
        "This goal is covered by a chosen holding minimum. Lower that minimum first.",
      );
    left -= value - row.recommendedMonthly;
    row.recommendedMonthly = value;
  }
  if (left < 0) throw Error("Monthly allocations exceed available savings.");
  const adjustable = (row: HybridGoal) =>
    !Object.hasOwn(input.overrides ?? {}, row.goalId);
  const give = (row: HybridGoal, cap: number) => {
    const amount = Math.min(left, Math.max(0, cap - row.recommendedMonthly));
    row.recommendedMonthly += amount;
    left -= amount;
  };
  const essentials = ordered.filter(
    (r) => r.category === "essential" && adjustable(r),
  );
  for (const r of essentials) give(r, r.effectiveMinimumMonthly);
  for (const r of essentials) give(r, r.requiredMonthly);
  const flexible = rows.filter(
    (r) => r.category === "flexible" && adjustable(r),
  );
  const weight = (r: HybridGoal, need: number) =>
    new D(policy.priority[r.priority])
      .times(
        policy.urgency[
          r.months !== null && r.months <= 12
            ? 0
            : r.months !== null && r.months <= 36
              ? 1
              : 2
        ],
      )
      .times(need);
  const distribute = (minimums: boolean) => {
    const items = flexible.map((r) => {
      const need = Math.max(
        0,
        (minimums ? r.effectiveMinimumMonthly : r.requiredMonthly) -
          r.recommendedMonthly,
      );
      return {
        id: r.goalId,
        cap: need,
        weight: weight(
          r,
          Math.max(0, r.requiredMonthly - r.recommendedMonthly),
        ),
      };
    });
    const amounts = weightedAllocate(left, items);
    for (const r of flexible) {
      const n = amounts[r.goalId] ?? 0;
      r.recommendedMonthly += n;
      left -= n;
    }
  };
  distribute(true);
  distribute(false);
  const adjustmentRoom=budget-planLimit+left;
  for (const row of rows) {
    const rate = row.assumptions.annualReturnPct,
      months = row.months ?? 0;
    row.projectedCorpus =
      row.projectedExistingCorpus +
      endMonthValue(row.oneTimeAllocated, row.recommendedMonthly, rate, months);
    row.monthlyShortfall = Math.max(
      0,
      row.requiredMonthly - row.recommendedMonthly,
    );
    row.minimumShortfall = Math.max(
      0,
      row.effectiveMinimumMonthly - row.recommendedMonthly,
    );
    row.projectedShortfall = Math.max(
      0,
      row.targetCorpus - row.projectedCorpus,
    );
    row.projectedSurplus = Math.max(0, row.projectedCorpus - row.targetCorpus);
    const bill = source.find((g) => g.id === row.goalId)?.type === "bills_fund";
    if (row.status !== "fully_funded")
      row.status =
        !row.needsDate && row.projectedShortfall === 0 && !bill
          ? "on_track"
          : bill && row.monthlyShortfall === 0
            ? "on_track"
            : row.months !== 0 &&
                !row.needsDate &&
                row.monthlyShortfall <=
                  adjustmentRoom+(budget * policy.atRiskMonthlyIncreasePct) / 100
              ? "at_risk"
              : "underfunded";
    if (row.months === 0) row.immediateShortfall = row.projectedShortfall;
    if (bill) {
      row.projectedCorpus =
        row.existingCoverage +
        row.oneTimeAllocated +
        row.recommendedMonthly * 12;
      const state = hybridBillsForecast(
        source.find((g) => g.id === row.goalId)!.bills ?? [],
        row.existingCoverage + row.oneTimeAllocated,
        row.recommendedMonthly,
        input.today,
      );
      row.projectedShortfall = Math.max(
        0,
        row.targetCorpus - row.projectedCorpus,
        state.cashflowShortfall,
      );
      row.projectedSurplus = Math.max(
        0,
        row.projectedCorpus - row.targetCorpus,
      );
      row.immediateShortfall = state.immediateShortfall;
      if (state.cashflowShortfall > 0)
        row.status =
          row.monthlyShortfall > 0 &&
          row.monthlyShortfall <=
            adjustmentRoom+(budget * policy.atRiskMonthlyIncreasePct) / 100 &&
          state.immediateShortfall === 0
            ? "at_risk"
            : "underfunded";
    }

    if (row.currentMonthly > row.recommendedMonthly)
      row.warnings.push(
        "Recorded SIPs exceed this recommendation. Review them with your provider; nothing is reduced automatically.",
      );
    row.alternatives = {
      additionalMonthly: row.monthlyShortfall,
      revisedDeadline: null,
      achievableTarget: row.projectedCorpus,
      achievableTargetInOriginalBasis:
        row.assumptions.targetType === "today"
          ? integer(
              new D(row.projectedCorpus).div(
                growth(row.assumptions.inflationPct, row.months ?? 0),
              ),
            )
          : row.projectedCorpus,
    };
    if (
      row.monthlyShortfall > 0 &&
      row.recommendedMonthly > 0 &&
      !bill &&
      !row.needsDate
    ) {
      const original = source.find((g) => g.id === row.goalId)!;
      const holdingGrowth = links
        .filter((l) => l.goalId === row.goalId)
        .map((l) => {
          const inv = input.investments.find((i) => i.id === l.investmentId)!;
          return {
            inv,
            value: new D(inv.value).times(l.percent).div(100),
            factor: growth(
              row.assumptions.existingInvestmentReturns.find(
                (h) => h.investmentId === inv.id,
              )?.annualReturnPct ??
                inv.returnPct ??
                defaultReturn(inv.kind, inv.category),
              1,
            ),
          };
        });
      let futureContributions = new D(row.oneTimeAllocated),
        target = new D(original.target);
      const contributionFactor = growth(rate, 1),
        inflationFactor = growth(row.assumptions.inflationPct, 1);
      for (let m = 1; m <= policy.maxExtensionMonths; m++) {
        futureContributions = futureContributions
          .times(contributionFactor)
          .plus(row.recommendedMonthly);
        target =
          row.assumptions.targetType === "future"
            ? new D(row.targetCorpus)
            : target.times(inflationFactor);
        let existing = new D(0);
        for (const h of holdingGrowth) {
          h.value = h.value.times(h.factor);
          if (
            accessible(
              h.inv,
              { ...original, targetDate: addMonths(input.today, m) },
              input.today,
            )
          )
            existing = existing.plus(h.value);
        }
        if (
          m >= months &&
          existing.plus(futureContributions).greaterThanOrEqualTo(target)
        ) {
          row.alternatives.revisedDeadline = addMonths(input.today, m);
          break;
        }
      }
    }
  }
  const unallocatedInvestments = [...input.investments]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((i) => ({
      investmentId: i.id,
      value: integer(
        new D(i.value)
          .times(
            new D(100).minus(
              links
                .filter((l) => l.investmentId === i.id)
                .reduce((s, l) => s.plus(l.percent), new D(0)),
            ),
          )
          .div(100),
      ),
    }));
  const warnings = [
    "Projections are assumptions, not guaranteed returns. Recorded balances are not changed.",
    ...(Object.keys(input.overrides ?? {}).length
      ? ["Manual overrides are respected and may leave essential goals short."]
      : []),
  ];
  const valuationDates = new Set(
    input.investments
      .filter((i) => i.value > 0 && i.valuationDate)
      .map((i) => i.valuationDate),
  );
  if (valuationDates.size > 1)
    warnings.push(
      "Holdings have different valuation dates. This snapshot uses recorded values and does not normalize NAVs to a common market date.",
    );
  return {
    strategy: "hybrid",
    riskTolerance: input.riskTolerance ?? null,
    engineVersion: HYBRID_VERSION,
    calculatedOn: input.today,
    policy,
    availableMonthlySavings: budget,
    monthlyPlanLimit: planLimit,
    reservedOutsideGoals: input.reservedOutsideGoals ?? 0,
    budgetDeficit: money(input.budgetDeficit ?? 0),
    totalMonthlyRequired: rows.reduce((s, r) => s + r.requiredMonthly, 0),
    totalMonthlyAllocated: planLimit - left,
    unallocatedSavings: budget - planLimit + left,
    immediateFundingShortfall: rows.reduce(
      (s, r) => s + r.immediateShortfall,
      0,
    ),
    monthlyContributionShortfall: rows.reduce(
      (s, r) => s + r.monthlyShortfall,
      0,
    ),
    oneTimeAllocated: oneTime - lumpLeft,
    unallocatedOneTime: lumpLeft,
    goals: rows,
    links,
    unallocatedInvestments,
    warnings,
  };
}
