import type { HoldingRowState } from "@/components/forms/holdings-form";
import type { IncomeRowState } from "@/components/forms/income-form";
import type { InsuranceRowState } from "@/components/forms/insurance-form";
import type { LiabilityRowState } from "@/components/forms/liabilities-form";
import type { ExpenseRowState } from "@/components/forms/expenses-form";
import type { GoalFormState } from "@/components/forms/goal-form";
import { addMonths } from "@/lib/engine/dates";
import type { GoalType } from "@/lib/engine/types";
import type { GoalRow, RawData } from "@/lib/data";

export function incomeState(raw: RawData, todayISO: string): IncomeRowState[] {
  const thisMonth = `${todayISO.slice(0, 7)}-01`;
  return raw.incomes.map((s) => {
    const byMonth = new Map(raw.entries.filter((e) => e.stream_id === s.id).map((e) => [e.month, e.amount]));
    return {
      id: s.id,
      label: s.label,
      type: s.type,
      amountMonthly: s.amount_monthly,
      fixedMonthly: s.fixed_monthly,
      isGross: s.is_gross,
      isPrimary: s.is_primary,
      history: Array.from({ length: 6 }, (_, k) => byMonth.get(addMonths(thisMonth, -(k + 1))) ?? null),
    };
  });
}

export const expenseState = (raw: RawData): ExpenseRowState[] =>
  raw.expenses.map((e) => ({ id: e.id, category: e.category, amountMonthly: e.amount_monthly, isEssential: e.is_essential }));

export const insuranceState = (raw: RawData): InsuranceRowState[] =>
  raw.insurance.map((p) => ({
    id: p.id,
    kind: p.kind,
    source: p.source,
    coverAmount: p.cover_amount,
    premium: p.premium,
    renewalMonth: p.renewal_month,
  }));

export const liabilityState = (raw: RawData): LiabilityRowState[] =>
  raw.liabilities.map((l) => ({
    id: l.id,
    kind: l.kind,
    label: l.label ?? "",
    outstanding: l.outstanding,
    interestRate: l.interest_rate === null ? "" : String(Number(l.interest_rate)),
    emi: l.emi,
  }));

export const holdingState = (raw: RawData): HoldingRowState[] =>
  raw.holdings.map((h) => ({
    id: h.id,
    kind: h.kind,
    name: h.name ?? "",
    category: h.category ?? "other",
    currentValue: h.current_value,
    monthlySip: h.monthly_sip,
  }));

export function goalState(g: GoalRow | null, todayISO: string, type: GoalType = "custom"): GoalFormState {
  if (!g) {
    return {
      name: "",
      type,
      targetToday: null,
      targetDate: addMonths(todayISO, type === "retirement" ? 300 : 36),
      priority: type === "retirement" ? 2 : 3,
      inflationRate: "",
      savedAmount: null,
    };
  }
  return {
    id: g.id,
    name: g.name,
    type: g.type,
    targetToday: g.target_today,
    targetDate: g.target_date,
    priority: g.priority,
    inflationRate: g.inflation_rate === null ? "" : String(Number(g.inflation_rate)),
    savedAmount: g.saved_amount,
  };
}
