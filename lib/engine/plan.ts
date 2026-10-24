// "Your money plan": assigns every rupee of a month's regular income to a
// line with a purpose and, for money kept or invested, the category to keep
// it in. Category labels only, never fund names.

import { allocateToGoals } from "./goals";
import { categoryLabel } from "./categories";
import type { Analysis } from "./index";
import type { FinanceData } from "./types";

export type PlanGroup = "essentials" | "set_aside" | "debt" | "save" | "invest" | "wants";

export interface PlanLine {
  group: PlanGroup;
  label: string;
  amount: number;
  /** Where the money goes or is kept (category level). */
  where?: string;
  note?: string;
}

export interface MoneyPlan {
  /** Regular monthly income before the tax reserve. */
  income: number;
  lines: PlanLine[];
  totals: Record<PlanGroup, number>;
  /** Income left after every line (rounding, or nothing to assign it to). */
  unassigned: number;
  noIncome: boolean;
  runwayMonths: number | null;
  notes: string[];
}

const LIQUID_HOME = "Savings account, sweep FD or liquid fund";
const SET_ASIDE_HOME = "Separate savings account, sweep FD or RD";

const LIABILITY_NAMES: Record<string, string> = {
  credit_card: "Credit card",
  personal_loan: "Personal loan",
  car: "Car loan",
  home: "Home loan",
  education: "Education loan",
  other: "Loan",
};

export function buildMoneyPlan(data: FinanceData, analysis: Analysis): MoneyPlan {
  const { budget, nextFocus, goals, retirementBaseline } = analysis;
  const lines: PlanLine[] = [];
  const notes: string[] = [];
  const round = Math.round;

  // Tax reserve for freelance and business income comes off the top.
  const taxReserve = budget.freelancer?.taxReserveMonthly ?? 0;
  const income = budget.expectedIncome + taxReserve;
  if (taxReserve > 0) {
    lines.push({
      group: "set_aside",
      label: "Tax reserve (advance tax)",
      amount: taxReserve,
      where: "Separate savings account",
      note: budget.freelancer?.nextAdvanceTaxDate ? `Next due ${budget.freelancer.nextAdvanceTaxDate}` : undefined,
    });
  }

  // Essentials: expenses, EMIs, premiums and planned set-asides.
  if (budget.essentials.estimated) {
    lines.push({
      group: "essentials",
      label: "Living costs (estimated)",
      amount: budget.essentials.expenses,
      note: "Add your expenses to make this exact",
    });
  } else {
    for (const e of data.expenses.filter((x) => x.isEssential && x.amountMonthly > 0)) {
      lines.push({ group: "essentials", label: e.category, amount: e.amountMonthly });
    }
  }
  for (const l of data.liabilities.filter((x) => (x.emi ?? 0) > 0 && x.outstanding > 0)) {
    lines.push({ group: "essentials", label: `${l.label || LIABILITY_NAMES[l.kind] || "Loan"} EMI`, amount: l.emi ?? 0 });
  }
  for (const p of data.insurance.filter((x) => (x.premium ?? 0) > 0 && x.inBudget !== false)) {
    const name = `${p.kind === "term" ? "Term" : p.kind === "health" ? "Health" : "Other"} insurance${p.covers === "others" ? " (family)" : ""}`;
    const monthly = round((p.premium ?? 0) / 12);
    if (p.frequency === "monthly") {
      lines.push({ group: "essentials", label: `${name} premium`, amount: monthly });
    } else {
      lines.push({
        group: "set_aside",
        label: `Save for ${name.toLowerCase()} renewal`,
        amount: monthly,
        where: SET_ASIDE_HOME,
      });
    }
  }
  for (const p of (data.plannedExpenses ?? []).filter((x) => x.inBudget && x.amount > 0)) {
    lines.push({
      group: "set_aside",
      label: `Save for ${p.name.toLowerCase()}`,
      amount: round(p.amount / Math.max(1, p.everyMonths)),
      where: SET_ASIDE_HOME,
    });
  }

  if (analysis.noIncome) {
    const totals = sumGroups(lines);
    const months = analysis.runway.months;
    notes.push(
      months === null
        ? "No income right now. Add your expenses to see how long your savings last."
        : `No income right now. These costs come from your savings, which cover about ${Math.floor(months)} month${Math.floor(months) === 1 ? "" : "s"}.`,
    );
    return { income: 0, lines, totals, unassigned: 0, noIncome: true, runwayMonths: months, notes };
  }

  // Savings pool: the savings target plus the plan and goals share of surplus.
  let wants = budget.split.wants + budget.monthlySurplus.wants;
  const stepPool = budget.split.savings + budget.monthlySurplus.ladder;
  let goalsPool = budget.monthlySurplus.goals;

  // Existing SIPs keep running.
  const goalNames = new Map(data.goals.map((g) => [g.id, g.name]));
  let sips = 0;
  for (const h of data.holdings.filter((x) => (x.monthlySip ?? 0) > 0)) {
    const linked = data.allocations
      .filter((a) => a.holdingId === h.id)
      .map((a) => goalNames.get(a.goalId))
      .filter(Boolean);
    lines.push({
      group: "invest",
      label: h.name || categoryLabel(h.category),
      amount: h.monthlySip ?? 0,
      where: categoryLabel(h.category),
      note: linked.length ? `For ${linked.join(", ")}` : "Not linked to a goal yet",
    });
    sips += h.monthlySip ?? 0;
  }

  let newMoney = stepPool - sips;
  if (newMoney < 0) {
    // SIPs are bigger than the savings target: they come out of goals money, then wants.
    const fromGoals = Math.min(goalsPool, -newMoney);
    goalsPool -= fromGoals;
    newMoney += fromGoals;
    if (newMoney < 0) {
      wants += newMoney;
      notes.push("Your SIPs are more than your savings target, so they take some of your spending money.");
      newMoney = 0;
    }
  }

  const step = nextFocus?.step;
  const toGoals = (amount: number) => {
    if (amount <= 0) return;
    if (goals.length === 0) {
      lines.push({ group: "save", label: "Savings for your next goal", amount, where: LIQUID_HOME, note: "Add a goal to give it a job" });
      return;
    }
    const split = allocateToGoals(goals, amount, retirementBaseline);
    let given = 0;
    for (const s of split) {
      const g = goals.find((x) => x.goalId === s.goalId)!;
      lines.push({
        group: "invest",
        label: g.name,
        amount: s.amount,
        where: g.categories.slice(0, 2).join(" or "),
        note: g.openEnded ? "No deadline" : g.targetDate ? `By ${g.targetDate}` : undefined,
      });
      given += s.amount;
    }
    if (amount - given > 0) {
      lines.push({
        group: "invest",
        label: "Extra for the long term",
        amount: amount - given,
        where: "Equity index fund, or top up retirement",
        note: "Every goal is already funded at its pace",
      });
    }
  };

  if (!step || step.key === "goals") {
    toGoals(newMoney + goalsPool);
  } else if (step.key === "cash_flow") {
    notes.push("Essentials cost more than your income, so there's nothing to save until that changes.");
  } else if (step.key === "high_interest_debt" && step.debts?.length) {
    const d = step.debts[0];
    lines.push({
      group: "debt",
      label: `Extra payment: ${d.label || LIABILITY_NAMES[d.kind] || "debt"}`,
      amount: newMoney,
      where: "Pay the highest-rate debt first",
      note: d.interestRate !== null ? `${d.interestRate}% a year` : undefined,
    });
    toGoals(goalsPool);
  } else {
    const efDone = analysis.ladder.find((s) => s.key === "emergency_fund")?.status === "done";
    if (efDone && step.kind === "cover") {
      toGoals(newMoney + goalsPool);
    } else {
      lines.push({
        group: "save",
        label: step.key === "starter_buffer" ? "Starter buffer" : "Emergency fund",
        amount: newMoney,
        where: LIQUID_HOME,
        note: step.kind === "cover" ? `Also: ${nextFocus?.title.toLowerCase()}` : undefined,
      });
      toGoals(goalsPool);
    }
  }

  if (wants > 0) lines.push({ group: "wants", label: "Spending money", amount: wants, note: "Eating out, shopping, fun" });

  const kept = lines.filter((l) => l.amount > 0);
  const totals = sumGroups(kept);
  const assigned = Object.values(totals).reduce((s, x) => s + x, 0);
  if (budget.oneOff.total > 0) {
    notes.push(
      `One-off income of ₹${budget.oneOff.total.toLocaleString("en-IN")}: ₹${budget.oneOff.ladder.toLocaleString("en-IN")} to your next step, ₹${budget.oneOff.goals.toLocaleString("en-IN")} to goals, ₹${budget.oneOff.wants.toLocaleString("en-IN")} for wants.`,
    );
  }
  return {
    income,
    lines: kept,
    totals,
    unassigned: Math.max(0, income - assigned),
    noIncome: false,
    runwayMonths: analysis.runway.months,
    notes,
  };
}

function sumGroups(lines: PlanLine[]): Record<PlanGroup, number> {
  const t: Record<PlanGroup, number> = { essentials: 0, set_aside: 0, debt: 0, save: 0, invest: 0, wants: 0 };
  for (const l of lines) t[l.group] += l.amount;
  return t;
}
