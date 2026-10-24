import type { EngineConfig } from "./config";
import { nextYearlyDate } from "./dates";
import type { Expense, FinanceData, IncomeStream } from "./types";

export type StreamRole =
  | "base"
  | "variable_salary"
  | "secondary_job"
  | "freelance"
  | "bonus";

export interface Split {
  ladder: number;
  goals: number;
  wants: number;
}

export interface StreamBudget {
  id: string;
  label: string;
  type: IncomeStream["type"];
  role: StreamRole;
  /** What usually arrives each month (after tax reserve for freelance). */
  expectedMonthly: number;
  base: number;
  surplus: number;
  taxReserve: number;
  split: Split;
  /** Bonus streams are one-off and kept out of monthly totals. */
  oneOff: boolean;
  reason: string;
}

export interface EssentialsBreakdown {
  expenses: number;
  emis: number;
  insurancePremiums: number;
  total: number;
  /** True when expenses were not entered and the fallback share of base was used. */
  estimated: boolean;
  biggestLines: { label: string; amount: number }[];
}

export interface BaseSplit {
  essentials: number;
  savings: number;
  wants: number;
  /** Money still missing when essentials exceed base income. */
  shortfall: number;
  reason: string;
}

export interface FreelancerInfo {
  payYourselfSalary: number;
  taxReserveMonthly: number;
  bufferTarget: number;
  nextAdvanceTaxDate: string | null;
}

export interface BudgetResult {
  streams: StreamBudget[];
  baseIncome: number;
  /** Regular monthly income (base + monthly surplus), bonuses excluded. */
  expectedIncome: number;
  monthlySurplus: Split;
  oneOff: Split & { total: number };
  essentials: EssentialsBreakdown;
  split: BaseSplit;
  cashFlowOk: boolean;
  freelancer: FreelancerInfo | null;
  notes: string[];
  reason: string;
}

const round = (n: number) => Math.round(n);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

function cleanHistory(stream: IncomeStream, maxMonths: number): number[] {
  return (stream.history ?? [])
    .filter((n) => Number.isFinite(n) && n >= 0)
    .slice(0, maxMonths);
}

function splitBy(amount: number, rule: { ladder: number; goals: number; wants: number }): Split {
  const ladder = round(amount * rule.ladder);
  const goals = round(amount * rule.goals);
  return { ladder, goals, wants: amount - ladder - goals };
}

const SALARY_TYPES = new Set(["stable_salary", "variable_salary"]);

/** Picks the primary job when someone has more than one salary stream. */
export function primarySalaryId(streams: IncomeStream[]): string | null {
  const salaries = streams.filter((s) => s.active !== false && SALARY_TYPES.has(s.type));
  if (salaries.length === 0) return null;
  const flagged = salaries.find((s) => s.isPrimary);
  if (flagged) return flagged.id;
  return [...salaries].sort((a, b) => b.amountMonthly - a.amountMonthly)[0].id;
}

export function hasMultipleJobs(streams: IncomeStream[]): boolean {
  return streams.filter((s) => s.active !== false && SALARY_TYPES.has(s.type)).length > 1;
}

export function budgetStream(
  stream: IncomeStream,
  cfg: EngineConfig,
  isSecondaryJob: boolean,
): StreamBudget {
  const b = cfg.budget;
  const common = { id: stream.id, label: stream.label, type: stream.type, taxReserve: 0, oneOff: false };
  const zero: Split = { ladder: 0, goals: 0, wants: 0 };

  if (stream.type === "bonus") {
    const amount = round(stream.amountMonthly);
    return {
      ...common,
      role: "bonus",
      expectedMonthly: 0,
      base: 0,
      surplus: amount,
      split: splitBy(amount, b.bonusSurplus),
      oneOff: true,
      reason: "Bonuses are one-off, so none of it goes into your monthly base.",
    };
  }

  if (isSecondaryJob) {
    const history = cleanHistory(stream, b.freelance.historyMonths);
    const expected = round(history.length ? avg(history) : stream.amountMonthly);
    const ladderGoals = round(expected * b.secondarySurplus.ladderGoals);
    const ladder = round(ladderGoals / 2);
    return {
      ...common,
      role: "secondary_job",
      expectedMonthly: expected,
      base: 0,
      surplus: expected,
      split: { ladder, goals: ladderGoals - ladder, wants: expected - ladderGoals },
      reason: "Second-job income never pays for essentials, so it all goes to your plan and wants.",
    };
  }

  if (stream.type === "variable_salary") {
    const history = cleanHistory(stream, b.freelance.historyMonths);
    const expected = round(history.length ? avg(history) : stream.amountMonthly);
    let base: number;
    let reason: string;
    if (stream.fixedMonthly && stream.fixedMonthly > 0) {
      base = round(stream.fixedMonthly);
      reason = "Your fixed pay is your base. Incentives on top follow the surplus rule.";
    } else if (history.length) {
      base = round(Math.min(...history));
      reason = "With no fixed part, your lowest recent month is the base you can count on.";
    } else {
      base = expected;
      reason = "Add your last few months of pay so we can find the part you can count on.";
    }
    base = Math.min(base, expected);
    const surplus = expected - base;
    return {
      ...common,
      role: "variable_salary",
      expectedMonthly: expected,
      base,
      surplus,
      split: splitBy(surplus, b.variableSurplus),
      reason,
    };
  }

  if (stream.type === "freelance" || stream.type === "business") {
    const raw = cleanHistory(stream, b.freelance.historyMonths);
    const months = raw.length ? raw : [stream.amountMonthly];
    const tax = b.freelance.taxReservePct;
    const net = months.map((m) => m * (1 - tax));
    const lowest = [...net].sort((a, c) => a - c).slice(0, b.freelance.payYourselfLowestN);
    const base = round(avg(lowest));
    const expected = round(avg(net));
    const surplus = Math.max(0, expected - base);
    return {
      ...common,
      role: "freelance",
      taxReserve: round(avg(months) * tax),
      expectedMonthly: expected,
      base,
      surplus,
      split: splitBy(surplus, b.variableSurplus),
      reason: raw.length
        ? "Tax is set aside first, then you pay yourself the average of your leanest months."
        : "Add your last 6 months of income so your pay-yourself salary reflects lean months.",
    };
  }

  // Stable salary, rental and other: the whole amount is base.
  const amount = round(stream.amountMonthly);
  return {
    ...common,
    role: "base",
    expectedMonthly: amount,
    base: amount,
    surplus: 0,
    split: zero,
    reason: "Steady income, so all of it counts as base.",
  };
}

export function computeEssentials(
  data: Pick<FinanceData, "expenses" | "liabilities" | "insurance" | "profile">,
  baseIncome: number,
  cfg: EngineConfig,
): EssentialsBreakdown {
  const essentialRows = data.expenses.filter((e: Expense) => e.isEssential);
  const expensesKnown =
    data.expenses.length > 0 || data.profile.answered.includes("expenses");
  const expenses = expensesKnown
    ? round(sum(essentialRows.map((e) => e.amountMonthly)))
    : round(baseIncome * cfg.budget.essentialsFallbackPct);
  const emis = round(sum(data.liabilities.filter((l) => l.outstanding > 0).map((l) => l.emi ?? 0)));
  // Employer-paid premiums are not your outflow.
  const insurancePremiums = round(
    sum(data.insurance.filter((p) => p.source !== "employer").map((p) => (p.premium ?? 0) / 12)),
  );
  const lines = [
    ...essentialRows.map((e) => ({ label: e.category, amount: round(e.amountMonthly) })),
    ...data.liabilities
      .filter((l) => (l.emi ?? 0) > 0 && l.outstanding > 0)
      .map((l) => ({ label: `${l.label || l.kind.replace("_", " ")} EMI`, amount: round(l.emi ?? 0) })),
  ];
  if (insurancePremiums > 0) lines.push({ label: "Insurance premiums", amount: insurancePremiums });
  return {
    expenses,
    emis,
    insurancePremiums,
    total: expenses + emis + insurancePremiums,
    estimated: !expensesKnown,
    biggestLines: lines.sort((a, b) => b.amount - a.amount).slice(0, 3),
  };
}

/** Splits base income into essentials, savings and wants. */
export function splitBase(
  base: number,
  essentials: number,
  savingsNeed: number,
  cfg: EngineConfig,
): BaseSplit {
  if (essentials >= base) {
    return {
      essentials,
      savings: 0,
      wants: 0,
      shortfall: essentials - base,
      reason: "Your essentials use up all of your base income, so nothing is left to save yet.",
    };
  }
  const floor = round(base * cfg.budget.savingsMinPct);
  const desired = Math.max(floor, round(savingsNeed));
  const cap = Math.max(0, round(base * cfg.budget.essentialsPlusSavingsCapPct) - essentials);
  const savings = Math.min(desired, cap);
  const wants = base - essentials - savings;
  let reason: string;
  if (savings < desired) {
    reason = "Savings are capped so you always keep some money for everyday wants.";
  } else if (desired > floor) {
    reason = "Savings are set by what your current step and goals need.";
  } else {
    reason = `Saving ${Math.round(cfg.budget.savingsMinPct * 100)}% of base income is the starting target.`;
  }
  return { essentials, savings, wants, shortfall: 0, reason };
}

export function computeBudget(
  data: FinanceData,
  cfg: EngineConfig,
  options: { savingsNeed?: number; todayISO: string },
): BudgetResult {
  const active = data.incomes.filter((s) => s.active !== false);
  const primaryId = primarySalaryId(active);
  const multipleJobs = hasMultipleJobs(active);
  const streams = active.map((s) =>
    budgetStream(s, cfg, multipleJobs && SALARY_TYPES.has(s.type) && s.id !== primaryId),
  );

  const regular = streams.filter((s) => !s.oneOff);
  const baseIncome = sum(regular.map((s) => s.base));
  const expectedIncome = sum(regular.map((s) => s.base + s.surplus));
  const monthlySurplus: Split = {
    ladder: sum(regular.map((s) => s.split.ladder)),
    goals: sum(regular.map((s) => s.split.goals)),
    wants: sum(regular.map((s) => s.split.wants)),
  };
  const oneOffStreams = streams.filter((s) => s.oneOff);
  const oneOff = {
    total: sum(oneOffStreams.map((s) => s.surplus)),
    ladder: sum(oneOffStreams.map((s) => s.split.ladder)),
    goals: sum(oneOffStreams.map((s) => s.split.goals)),
    wants: sum(oneOffStreams.map((s) => s.split.wants)),
  };

  const essentials = computeEssentials(data, baseIncome, cfg);
  const split = splitBase(baseIncome, essentials.total, options.savingsNeed ?? 0, cfg);
  const cashFlowOk = essentials.total < baseIncome;

  const freelanceStreams = streams.filter((s) => s.role === "freelance");
  const freelancer: FreelancerInfo | null = freelanceStreams.length
    ? {
        payYourselfSalary: sum(freelanceStreams.map((s) => s.base)),
        taxReserveMonthly: sum(freelanceStreams.map((s) => s.taxReserve)),
        bufferTarget:
          sum(freelanceStreams.map((s) => s.base)) * cfg.budget.freelance.bufferTargetMonths,
        nextAdvanceTaxDate: nextYearlyDate(options.todayISO, cfg.budget.advanceTaxDates),
      }
    : null;

  const notes: string[] = [];
  for (const s of active) {
    if (s.isGross && s.type !== "bonus") {
      notes.push(`"${s.label}" is entered before tax. Enter the in-hand amount for a sharper budget.`);
    }
  }
  if (essentials.estimated) {
    notes.push("Essentials are estimated at half your base income. Add your expenses to make this real.");
  }

  const reason = cashFlowOk
    ? "Your base income covers essentials first, then savings, and what's left is yours to spend."
    : "Your essentials cost more than your base income. Fixing that comes before anything else.";

  return {
    streams,
    baseIncome,
    expectedIncome,
    monthlySurplus,
    oneOff,
    essentials,
    split,
    cashFlowOk,
    freelancer,
    notes,
    reason,
  };
}
