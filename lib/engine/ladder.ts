import type { BudgetResult } from "./budget";
import { hasMultipleJobs } from "./budget";
import { isLiquid } from "./categories";
import type { EngineConfig } from "./config";
import type { GoalAnalysis } from "./goals";
import type { FinanceData, Liability, Section } from "./types";

export type StepStatus = "done" | "todo" | "unknown" | "not_needed";
export type StepKind = "money" | "cover" | "cashflow" | "goals";

export interface LadderStep {
  id: number;
  key:
    | "cash_flow"
    | "starter_buffer"
    | "health_insurance"
    | "term_insurance"
    | "high_interest_debt"
    | "emergency_fund"
    | "goals";
  name: string;
  kind: StepKind;
  status: StepStatus;
  target: number;
  current: number;
  gap: number;
  /** When status is unknown: which profile section to ask about. */
  askAbout?: Section;
  reason: string;
  detail?: string;
  /** Extra data for the UI, e.g. debts in avalanche order. */
  debts?: Liability[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const SECTION_LABELS: Record<Section, string> = {
  household: "your household",
  income: "your income",
  expenses: "your monthly expenses",
  insurance: "your insurance",
  liabilities: "your loans and cards",
  holdings: "your savings",
  goals: "your goals",
  risk: "your risk comfort",
};

function known(data: FinanceData, section: Section, hasRows: boolean): boolean {
  return hasRows || data.profile.answered.includes(section);
}

/**
 * Liquid money that is free for emergencies: savings, FDs and liquid funds,
 * minus whatever share is earmarked for goals other than the emergency fund,
 * minus credit card bills that will be paid in full.
 */
export function liquidAssets(data: FinanceData): number {
  const nonEmergencyGoals = new Set(
    data.goals.filter((g) => g.type !== "emergency_fund").map((g) => g.id),
  );
  let total = 0;
  for (const h of data.holdings) {
    if (!isLiquid(h.kind, h.category)) continue;
    const earmarked = data.allocations
      .filter((a) => a.holdingId === h.id && nonEmergencyGoals.has(a.goalId))
      .reduce((s, a) => s + a.percent, 0);
    total += (h.currentValue * Math.max(0, 100 - Math.min(100, earmarked))) / 100;
  }
  // Card bills paid in full are already spoken for.
  const cardDues = (data.cards ?? []).reduce((s, c) => s + Math.max(0, c.outstanding), 0);
  return Math.max(0, Math.round(total - cardDues));
}

export function isHighInterest(l: Liability, cfg: EngineConfig): boolean {
  if (l.outstanding <= 0) return false;
  if (l.interestRate === null || l.interestRate === undefined) {
    return cfg.ladder.assumeHighInterestKinds.includes(l.kind);
  }
  return l.interestRate > cfg.ladder.highInterestThresholdPct;
}

/** Highest rate first; unknown rates on cards and personal loans go to the top. */
export function avalancheOrder(debts: Liability[]): Liability[] {
  return [...debts].sort(
    (a, b) => (b.interestRate ?? Infinity) - (a.interestRate ?? Infinity) || b.outstanding - a.outstanding,
  );
}

export function emergencyMonths(
  data: FinanceData,
  cfg: EngineConfig,
): { months: number; reason: string } {
  const m = cfg.ladder.emergencyMonths;
  const active = data.incomes.filter((s) => s.active !== false && s.type !== "bonus");
  const dependents = data.profile.dependents ?? 0;
  const freelance = active.some((s) => s.type === "freelance" || s.type === "business");
  const soleWithDeps = data.profile.soleEarner === true && dependents > 0;
  const variable = active.some((s) => s.type === "variable_salary");
  const multiple = hasMultipleJobs(active);

  const matches: { months: number; reason: string }[] = [
    { months: m.stableNoDependents, reason: "steady salary" },
  ];
  if (dependents > 0) matches.push({ months: m.stableWithDependents, reason: "people depend on you" });
  if (variable) matches.push({ months: m.variableSalary, reason: "part of your pay varies" });
  if (multiple) matches.push({ months: m.multipleJobs, reason: "you have more than one job" });
  if (freelance && soleWithDeps) {
    matches.push({
      months: m.freelanceAndSoleEarnerWithDependents,
      reason: "your income is self-employed and your family relies on it alone",
    });
  } else if (freelance) {
    matches.push({ months: m.freelanceOrBusiness, reason: "your income is self-employed" });
  } else if (soleWithDeps) {
    matches.push({ months: m.soleEarnerWithDependents, reason: "you are the only earner with dependents" });
  }
  return matches.reduce((best, x) => (x.months > best.months ? x : best));
}

export function evaluateLadder(
  data: FinanceData,
  budget: BudgetResult,
  goals: GoalAnalysis[],
  cfg: EngineConfig,
): LadderStep[] {
  const L = cfg.ladder;
  const essentials = budget.essentials.total;
  const liquid = liquidAssets(data);
  const holdingsKnown = known(data, "holdings", data.holdings.length > 0);
  const insuranceKnown = known(data, "insurance", data.insurance.length > 0);
  const liabilitiesKnown = known(data, "liabilities", data.liabilities.length > 0);
  const householdKnown =
    data.profile.answered.includes("household") || data.profile.dependents !== null;
  const steps: LadderStep[] = [];

  // Step 0: positive cash flow.
  steps.push({
    id: 0,
    key: "cash_flow",
    name: "Positive monthly cash flow",
    kind: "cashflow",
    status: budget.cashFlowOk ? "done" : "todo",
    target: budget.baseIncome,
    current: essentials,
    gap: budget.cashFlowOk ? 0 : essentials - budget.baseIncome,
    reason: budget.cashFlowOk
      ? "Your essentials and EMIs fit inside your base income."
      : "Your essentials and EMIs cost more than your base income. Until that changes, every other step stalls.",
    detail: budget.essentials.biggestLines.map((l) => l.label).join(", "),
  });

  // Step 1: starter buffer.
  const starterTarget = Math.round(essentials * L.starterBufferMonths);
  steps.push(
    holdingsKnown
      ? {
          id: 1,
          key: "starter_buffer",
          name: "Starter buffer",
          kind: "money",
          status: liquid >= starterTarget ? "done" : "todo",
          target: starterTarget,
          current: liquid,
          gap: Math.max(0, starterTarget - liquid),
          reason: `${L.starterBufferMonths} month of essentials in the bank stops small surprises from becoming debt.`,
        }
      : unknownStep(1, "starter_buffer", "Starter buffer", "money", "holdings", starterTarget),
  );

  // Step 2: health insurance.
  const metro = data.profile.cityTier === "metro" || data.profile.cityTier === null;
  const healthTarget = metro ? L.healthCoverMetro : L.healthCoverOther;
  const health = data.insurance.filter((p) => p.kind === "health");
  // Your own cover: personal or family floater that includes you. Policies
  // only for parents or others are in the budget but don't protect you.
  const ownHealth = sum(
    health.filter((p) => p.source !== "employer" && p.covers !== "others").map((p) => p.coverAmount),
  );
  const othersOnly = health.some((p) => p.covers === "others");
  const employerHealth = sum(health.filter((p) => p.source === "employer").map((p) => p.coverAmount));
  steps.push(
    insuranceKnown
      ? {
          id: 2,
          key: "health_insurance",
          name: "Health insurance",
          kind: "cover",
          status: ownHealth >= healthTarget ? "done" : "todo",
          target: healthTarget,
          current: ownHealth,
          gap: Math.max(0, healthTarget - ownHealth),
          reason:
            employerHealth > 0 && ownHealth < healthTarget
              ? "Your employer cover is a bonus, but it ends when the job does. Get a personal or family floater too."
              : othersOnly && ownHealth < healthTarget
                ? "The policy for your family members is counted in your budget, but it doesn't cover you. You need your own cover too."
                : "One hospital stay can wipe out years of savings. Your own cover protects your plan.",
          detail:
            data.profile.cityTier === null
              ? "Using the metro amount until you tell us your city."
              : undefined,
        }
      : unknownStep(2, "health_insurance", "Health insurance", "cover", "insurance", healthTarget),
  );

  // Step 3: term insurance.
  const dependents = data.profile.dependents ?? 0;
  const outstanding = sum(data.liabilities.map((l) => Math.max(0, l.outstanding)));
  const married = data.profile.maritalStatus === "married";
  const loansInherited = married && outstanding > 0;
  const annualIncome = budget.expectedIncome * 12;
  const rawTermTarget = L.termIncomeMultiple * annualIncome + outstanding - liquid;
  const termTarget = Math.max(0, Math.ceil(rawTermTarget / 100_000) * 100_000);
  const termCover = sum(data.insurance.filter((p) => p.kind === "term").map((p) => p.coverAmount));
  if (!householdKnown) {
    steps.push(unknownStep(3, "term_insurance", "Term insurance", "cover", "household", termTarget));
  } else if (dependents === 0 && married && !liabilitiesKnown) {
    steps.push(unknownStep(3, "term_insurance", "Term insurance", "cover", "liabilities", termTarget));
  } else if (dependents === 0 && !loansInherited) {
    steps.push({
      id: 3,
      key: "term_insurance",
      name: "Term insurance",
      kind: "cover",
      status: "not_needed",
      target: 0,
      current: termCover,
      gap: 0,
      reason: "No one depends on your income and no loans would pass to family, so term cover isn't needed yet.",
    });
  } else if (!insuranceKnown) {
    steps.push(unknownStep(3, "term_insurance", "Term insurance", "cover", "insurance", termTarget));
  } else {
    steps.push({
      id: 3,
      key: "term_insurance",
      name: "Term insurance",
      kind: "cover",
      status: termCover >= termTarget ? "done" : "todo",
      target: termTarget,
      current: termCover,
      gap: Math.max(0, termTarget - termCover),
      reason: `If something happened to you, ${L.termIncomeMultiple}x your yearly income plus your loans keeps your family going.`,
    });
  }

  // Step 4: high-interest debt.
  const highDebts = avalancheOrder(data.liabilities.filter((l) => isHighInterest(l, cfg)));
  steps.push(
    liabilitiesKnown
      ? {
          id: 4,
          key: "high_interest_debt",
          name: "Clear high-interest debt",
          kind: "money",
          status: highDebts.length === 0 ? "done" : "todo",
          target: 0,
          current: sum(highDebts.map((d) => d.outstanding)),
          gap: sum(highDebts.map((d) => d.outstanding)),
          debts: highDebts,
          reason:
            highDebts.length === 0
              ? `No debt above ${L.highInterestThresholdPct}% a year. Lower-rate home and education loans don't block you.`
              : `Debt above ${L.highInterestThresholdPct}% costs more than investing earns. Pay the highest rate first (the avalanche method).`,
        }
      : unknownStep(4, "high_interest_debt", "Clear high-interest debt", "money", "liabilities", 0),
  );

  // Step 5: full emergency fund.
  const ef = emergencyMonths(data, cfg);
  const efTarget = Math.round(essentials * ef.months);
  steps.push(
    holdingsKnown
      ? {
          id: 5,
          key: "emergency_fund",
          name: "Full emergency fund",
          kind: "money",
          status: liquid >= efTarget ? "done" : "todo",
          target: efTarget,
          current: liquid,
          gap: Math.max(0, efTarget - liquid),
          reason: `${ef.months} months of essentials, because ${ef.reason}. It comes before investing so a job loss never forces you to sell at a loss.`,
          detail: "Keep it in a savings account, sweep FD or liquid fund.",
        }
      : unknownStep(5, "emergency_fund", "Full emergency fund", "money", "holdings", efTarget),
  );

  // Step 6: goals.
  const behind = goals.filter((g) => g.status !== "funded" && g.status !== "on_track");
  const goalGap = sum(goals.map((g) => Math.max(0, g.futureTarget - g.projected)));
  steps.push({
    id: 6,
    key: "goals",
    name: "Fund your goals",
    kind: "goals",
    status: goals.length > 0 && behind.length === 0 ? "done" : goals.length === 0 ? "unknown" : "todo",
    askAbout: goals.length === 0 ? "goals" : undefined,
    target: sum(goals.map((g) => g.futureTarget)),
    current: sum(goals.map((g) => g.projected)),
    gap: goalGap,
    reason:
      goals.length === 0
        ? "Add a goal, starting with retirement, so your savings have a job to do."
        : behind.length === 0
          ? "Every goal is on track. Keep your SIPs running."
          : `Fund goals by priority, then by nearest date. ${behind.length} goal${behind.length > 1 ? "s are" : " is"} behind.`,
  });

  return steps;
}

function unknownStep(
  id: number,
  key: LadderStep["key"],
  name: string,
  kind: StepKind,
  askAbout: Section,
  target: number,
): LadderStep {
  return {
    id,
    key,
    name,
    kind,
    status: "unknown",
    target,
    current: 0,
    gap: 0,
    askAbout,
    reason: `Tell us about ${SECTION_LABELS[askAbout]} so we can check this step instead of guessing.`,
  };
}

export function currentStep(steps: LadderStep[]): LadderStep | null {
  return steps.find((s) => s.status === "todo" || s.status === "unknown") ?? null;
}
