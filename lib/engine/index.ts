import { computeBudget, type BudgetResult } from "./budget";
import { computeCompleteness, type CompletenessResult } from "./completeness";
import { mergeConfig, type EngineConfig } from "./config";
import { allocateToGoals, analyzeGoal, type GoalAnalysis } from "./goals";
import { simulatePayoff, type DebtPayoffPlan } from "./debt";
import { currentStep, evaluateLadder, isHighInterest, liquidAssets, SECTION_LABELS, type LadderStep } from "./ladder";
import type { FinanceData } from "./types";

export * from "./types";
export { mergeConfig, defaultConfig } from "./config";
export type { EngineConfig } from "./config";

export interface NextFocus {
  step: LadderStep;
  title: string;
  /** Gap in rupees (money missing, cover missing, or monthly shortfall). */
  gap: number;
  /** Suggested monthly amount toward this step, or null for cover steps. */
  monthly: number | null;
  monthsToComplete: number | null;
  reason: string;
  /** Short call to action for the button. */
  action: string;
  /** Where the action button goes. */
  href: string;
  goalSplit?: { goalId: string; name: string; amount: number }[];
  /** With no income: months your liquid savings cover essentials. */
  runwayMonths?: number | null;
}

export interface Analysis {
  config: EngineConfig;
  budget: BudgetResult;
  ladder: LadderStep[];
  goals: GoalAnalysis[];
  completeness: CompletenessResult;
  nextFocus: NextFocus | null;
  existingSips: number;
  retirementBaseline: number;
  /** True when there is no regular income right now (e.g. between jobs). */
  noIncome: boolean;
  /** Liquid savings free for emergencies, and how many months of essentials they cover. */
  runway: { liquid: number; months: number | null };
  /** Order and timeline for clearing debts, with the extra money available each month. */
  debtPlan: DebtPayoffPlan;
}

const SECTION_HREF: Record<string, string> = {
  household: "/details/household",
  income: "/details/income",
  expenses: "/details/expenses",
  insurance: "/details/insurance",
  liabilities: "/details/liabilities",
  holdings: "/holdings",
  goals: "/goals/new",
  risk: "/details/risk",
};

function stepNeedMonthly(step: LadderStep | null, cfg: EngineConfig): number {
  if (!step || step.status !== "todo" || step.kind !== "money") return 0;
  return Math.ceil(step.gap / cfg.ladder.targetMonthsToComplete);
}

export function analyze(data: FinanceData, overrides: unknown, todayISO: string): Analysis {
  const cfg = mergeConfig(overrides);
  const goals = data.goals.map((g) =>
    analyzeGoal(g, {
      holdings: data.holdings,
      allocations: data.allocations,
      risk: data.profile.riskProfile,
      todayISO,
      cfg,
    }),
  );
  const existingSips = data.holdings.reduce((s, h) => s + (h.monthlySip ?? 0), 0);

  // First pass: a plain budget to evaluate the ladder.
  const firstBudget = computeBudget(data, cfg, { todayISO });
  const ladder = evaluateLadder(data, firstBudget, goals, cfg);
  const step = currentStep(ladder);

  // Second pass: size the savings target to what the step and goals need.
  // Before step 6, existing SIPs keep running and new savings go to the step.
  const retirementBaseline = Math.round(firstBudget.baseIncome * cfg.ladder.retirementBaselinePct);
  const onGoals = !step || step.key === "goals";
  const goalsNeed = goals.reduce((s, g) => s + g.requiredMonthly, 0);
  const savingsNeed = onGoals
    ? Math.max(goalsNeed, retirementBaseline)
    : stepNeedMonthly(step, cfg) + existingSips;
  const budget = computeBudget(data, cfg, { todayISO, savingsNeed });
  const noIncome = budget.expectedIncome <= 0;
  const liquid = liquidAssets(data);
  const runway = {
    liquid,
    months: budget.essentials.total > 0 ? Math.floor((liquid / budget.essentials.total) * 10) / 10 : null,
  };

  // Extra money for costly debt: all new savings when debt is the current
  // step; otherwise only what's left after goals get their monthly amounts.
  const costly = data.liabilities.filter((l) => isHighInterest(l, cfg));
  let debtExtra = 0;
  if (costly.length && !noIncome && budget.cashFlowOk) {
    const available = Math.max(
      0,
      budget.split.savings + budget.monthlySurplus.ladder + budget.monthlySurplus.goals - existingSips,
    );
    if (step?.key === "high_interest_debt") {
      debtExtra = Math.max(0, budget.split.savings - existingSips) + budget.monthlySurplus.ladder;
    } else if (!step || step.key === "goals") {
      const toGoals = allocateToGoals(goals, available, retirementBaseline).reduce((s, x) => s + x.amount, 0);
      debtExtra = Math.max(0, available - toGoals);
    }
  }
  const debtPlan = simulatePayoff({
    debts: data.liabilities,
    isCostly: (l) => isHighInterest(l, cfg),
    extraMonthly: debtExtra,
    method: cfg.ladder.debtMethod,
    todayISO,
    cfg,
  });

  const focus = step ? buildNextFocus(step, budget, goals, existingSips, retirementBaseline, runway) : null;
  if (focus && step?.key === "goals" && debtExtra > 0) {
    focus.reason += ` After your goals, ₹${debtExtra.toLocaleString("en-IN")} a month is left to clear costly debt.`;
  }

  return {
    config: cfg,
    budget,
    ladder,
    goals,
    completeness: computeCompleteness(data, cfg),
    nextFocus: focus,
    existingSips,
    retirementBaseline,
    noIncome,
    runway,
    debtPlan,
  };
}

export function buildNextFocus(
  step: LadderStep,
  budget: BudgetResult,
  goals: GoalAnalysis[],
  existingSips: number,
  retirementBaseline: number,
  runway: { liquid: number; months: number | null } = { liquid: 0, months: null },
): NextFocus {
  if (step.status === "unknown" && step.askAbout) {
    const isGoals = step.askAbout === "goals";
    return {
      step,
      title: isGoals ? "Set your first goal" : `Tell us about ${SECTION_LABELS[step.askAbout]}`,
      gap: 0,
      monthly: null,
      monthsToComplete: null,
      reason: step.reason,
      action: isGoals ? "Add a goal" : "Add details",
      href: SECTION_HREF[step.askAbout] ?? "/settings",
    };
  }

  if (step.kind === "cashflow" && budget.expectedIncome <= 0) {
    const m = runway.months;
    const cover =
      m === null
        ? "Add your monthly expenses to see how long your savings last."
        : `Your savings cover about ${m < 1 ? "less than a month" : `${Math.floor(m)} month${Math.floor(m) === 1 ? "" : "s"}`} of essentials.`;
    return {
      step,
      title: "You're between incomes",
      gap: budget.essentials.total,
      monthly: null,
      monthsToComplete: null,
      runwayMonths: m,
      reason: `With no income right now, essentials of ₹${budget.essentials.total.toLocaleString("en-IN")} a month come from savings. ${cover} Pay EMIs and insurance premiums first, hold off on new investments, and keep existing SIPs only while you have more than 6 months covered. Once you add your salary, your normal plan comes back.`,
      action: "Update income",
      href: "/details/income",
    };
  }

  if (step.kind === "cashflow") {
    return {
      step,
      title: "Fix monthly cash flow",
      gap: step.gap,
      monthly: null,
      monthsToComplete: null,
      reason: `${step.reason} Your biggest costs: ${step.detail || "add your expenses to see them"}.`,
      action: "Review your budget",
      href: "/budget",
    };
  }

  if (step.kind === "cover") {
    return {
      step,
      title: step.key === "health_insurance" ? "Get your own health cover" : "Get term life cover",
      gap: step.gap,
      monthly: null,
      monthsToComplete: null,
      reason: step.reason,
      action: "Update insurance",
      href: "/details/insurance",
    };
  }

  if (step.kind === "goals") {
    const monthly = budget.split.savings + budget.monthlySurplus.ladder + budget.monthlySurplus.goals;
    const split = allocateToGoals(goals, Math.max(0, monthly - existingSips), retirementBaseline);
    const names = new Map(goals.map((g) => [g.goalId, g.name]));
    const totalNeed = goals.reduce((s, g) => s + g.requiredMonthly, 0);
    return {
      step,
      title: "Fund your goals",
      gap: step.gap,
      monthly,
      monthsToComplete: null,
      reason:
        monthly >= totalNeed
          ? "You can fund every goal at its required pace. Keep retirement contributions steady."
          : "Your savings fall short of every goal's pace, so the highest-priority and nearest goals get funded first.",
      action: "See goals",
      href: "/goals",
      goalSplit: split.map((s) => ({ ...s, name: names.get(s.goalId) ?? "Goal" })),
    };
  }

  // Money steps: starter buffer, high-interest debt, emergency fund.
  // Existing SIPs keep running; only new savings are redirected to the step.
  const newSavings = Math.max(0, budget.split.savings - existingSips);
  const monthly = newSavings + budget.monthlySurplus.ladder;
  const titles: Record<string, string> = {
    starter_buffer: "Build a 1-month starter buffer",
    high_interest_debt: "Clear costly debt",
    emergency_fund: "Complete your emergency fund",
  };
  const actions: Record<string, [string, string]> = {
    starter_buffer: ["Update savings", "/holdings"],
    high_interest_debt: ["Update loans", "/details/liabilities"],
    emergency_fund: ["Update savings", "/holdings"],
  };
  let reason = step.reason;
  if (monthly === 0) {
    reason += " Right now your existing SIPs use all of your savings target, so free up some new savings for this step.";
  }
  return {
    step,
    title: titles[step.key] ?? step.name,
    gap: step.gap,
    monthly,
    monthsToComplete: monthly > 0 ? Math.ceil(step.gap / monthly) : null,
    reason,
    action: actions[step.key]?.[0] ?? "Update",
    href: actions[step.key]?.[1] ?? "/dashboard",
  };
}
