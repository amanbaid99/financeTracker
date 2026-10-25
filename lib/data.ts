import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { analyze, type Analysis } from "@/lib/engine";
import { todayIST } from "@/lib/engine/dates";
import type { FinanceData, Section } from "@/lib/engine/types";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type Tables = Database["public"]["Tables"];
export type ProfileRow = Tables["profiles"]["Row"];
export type IncomeRow = Tables["income_streams"]["Row"];
export type IncomeEntryRow = Tables["income_entries"]["Row"];
export type ExpenseRow = Tables["expenses"]["Row"];
export type InsuranceRow = Tables["insurance_policies"]["Row"];
export type LiabilityRow = Tables["liabilities"]["Row"];
export type HoldingRow = Tables["holdings"]["Row"];
export type GoalRow = Tables["goals"]["Row"];
export type AllocationRow = Tables["goal_allocations"]["Row"];
export type CardRow = Tables["credit_cards"]["Row"];
export type PlannedRow = Tables["planned_expenses"]["Row"];
export type BillStatusRow = Tables["bill_status"]["Row"];
export type MonthBillRow = Tables["month_bills"]["Row"];

export interface RawData {
  profile: ProfileRow;
  incomes: IncomeRow[];
  entries: IncomeEntryRow[];
  expenses: ExpenseRow[];
  insurance: InsuranceRow[];
  liabilities: LiabilityRow[];
  holdings: HoldingRow[];
  goals: GoalRow[];
  allocations: AllocationRow[];
  cards: CardRow[];
  planned: PlannedRow[];
  /** Paid ticks for the current month (IST). */
  billStatus: BillStatusRow[];
  /** This month's bills plus every repeating bill series. */
  monthBills: MonthBillRow[];
  overrides: unknown;
}

/** The signed-in user, or a redirect to /login. Cached per request. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
});

export const loadRaw = cache(async (): Promise<RawData> => {
  const { supabase, user } = await requireUser();
  const thisMonth = `${todayIST().slice(0, 7)}-01`;
  const [
    profile,
    incomes,
    entries,
    expenses,
    insurance,
    liabilities,
    holdings,
    goals,
    allocations,
    settings,
    cards,
    planned,
    billStatus,
    monthBills,
  ] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("income_streams").select("*").order("created_at"),
      supabase.from("income_entries").select("*").order("month", { ascending: false }),
      supabase.from("expenses").select("*").order("amount_monthly", { ascending: false }),
      supabase.from("insurance_policies").select("*"),
      supabase.from("liabilities").select("*").order("outstanding", { ascending: false }),
      supabase.from("holdings").select("*").order("current_value", { ascending: false }),
      supabase.from("goals").select("*").order("priority").order("target_date"),
      supabase.from("goal_allocations").select("*"),
      supabase.from("settings").select("config_overrides").eq("user_id", user.id).maybeSingle(),
      supabase.from("credit_cards").select("*").order("created_at"),
      supabase.from("planned_expenses").select("*").order("next_due", { nullsFirst: false }),
      supabase.from("bill_status").select("*").eq("month", thisMonth),
      supabase
        .from("month_bills")
        .select("*")
        .or(`month.eq.${thisMonth},recurring.eq.true`)
        .order("month", { ascending: false }),
    ]);
  const firstError = [
    profile,
    incomes,
    entries,
    expenses,
    insurance,
    liabilities,
    holdings,
    goals,
    allocations,
    settings,
    cards,
    planned,
    billStatus,
    monthBills,
  ]
    .map((r) => r.error)
    .find(Boolean);
  if (firstError) throw new Error(`Could not load your data: ${firstError.message}`);
  if (!profile.data) throw new Error("Your profile is missing. Try signing out and in again.");
  return {
    profile: profile.data,
    incomes: incomes.data ?? [],
    entries: entries.data ?? [],
    expenses: expenses.data ?? [],
    insurance: insurance.data ?? [],
    liabilities: liabilities.data ?? [],
    holdings: holdings.data ?? [],
    goals: goals.data ?? [],
    allocations: allocations.data ?? [],
    cards: cards.data ?? [],
    planned: planned.data ?? [],
    billStatus: billStatus.data ?? [],
    monthBills: monthBills.data ?? [],
    overrides: settings.data?.config_overrides ?? {},
  };
});

function ageFrom(profile: ProfileRow, todayISO: string): number | null {
  if (profile.age !== null) return profile.age;
  if (!profile.dob) return null;
  const [y, m, d] = profile.dob.split("-").map(Number);
  const [ty, tm, td] = todayISO.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

export const PAYMENTS_PER_YEAR: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  half_yearly: 2,
  yearly: 1,
};

export function toFinanceData(raw: RawData, todayISO: string): FinanceData {
  const p = raw.profile;
  return {
    profile: {
      name: p.name,
      age: ageFrom(p, todayISO),
      cityTier: p.city_tier,
      maritalStatus: p.marital_status,
      dependents: p.dependents,
      soleEarner: p.sole_earner,
      riskProfile: p.risk_profile,
      answered: p.answered_sections as Section[],
    },
    incomes: raw.incomes.map((s) => ({
      id: s.id,
      label: s.label,
      type: s.type,
      amountMonthly: s.amount_monthly,
      fixedMonthly: s.fixed_monthly,
      isGross: s.is_gross,
      isPrimary: s.is_primary,
      active: s.active,
      history: raw.entries.filter((e) => e.stream_id === s.id).map((e) => e.amount),
    })),
    expenses: raw.expenses.map((e) => ({
      id: e.id,
      category: e.category,
      amountMonthly: e.amount_monthly,
      isEssential: e.is_essential,
    })),
    insurance: raw.insurance.map((i) => ({
      id: i.id,
      kind: i.kind,
      source: i.source,
      coverAmount: i.cover_amount,
      premium: i.premium === null ? null : i.premium * PAYMENTS_PER_YEAR[i.premium_frequency],
      covers: i.covers as "self" | "family" | "others",
      inBudget: i.in_budget,
      frequency: i.premium_frequency as "monthly" | "quarterly" | "half_yearly" | "yearly",
      renewalMonth: i.renewal_month,
    })),
    liabilities: raw.liabilities.map((l) => ({
      id: l.id,
      kind: l.kind,
      label: l.label,
      outstanding: l.outstanding,
      interestRate: l.interest_rate === null ? null : Number(l.interest_rate),
      emi: l.emi,
    })),
    holdings: raw.holdings.map((h) => ({
      id: h.id,
      kind: h.kind,
      name: h.name,
      category: h.category,
      currentValue: h.current_value,
      monthlySip: h.monthly_sip,
      sipStepUpPct: h.sip_step_up_pct === null ? null : Number(h.sip_step_up_pct),
      expectedReturnPct: h.expected_return_pct === null ? null : Number(h.expected_return_pct),
      purpose: (h.purpose as "spending" | "bills" | "savings" | null) ?? null,
      transitionFund: h.transition_fund ?? false,
    })),
    goals: raw.goals.map((g) => ({
      id: g.id,
      name: g.name,
      type: g.type,
      targetToday: g.target_today,
      targetDate: g.target_date,
      priority: g.priority,
      inflationRate: g.inflation_rate === null ? null : Number(g.inflation_rate),
      savedAmount: g.saved_amount,
    })),
    cards: raw.cards.map((c) => ({ id: c.id, label: c.label, outstanding: c.outstanding, dueDay: c.due_day })),
    plannedExpenses: raw.planned.map((p) => ({
      id: p.id,
      name: p.name,
      amount: p.amount,
      everyMonths: p.every_months,
      nextDue: p.next_due,
      inBudget: p.in_budget,
    })),
    allocations: raw.allocations.map((a) => ({
      goalId: a.goal_id,
      holdingId: a.holding_id,
      percent: Number(a.percent),
    })),
  };
}

export const loadAnalysis = cache(
  async (): Promise<{ raw: RawData; data: FinanceData; analysis: Analysis; today: string }> => {
    const raw = await loadRaw();
    const today = todayIST();
    const data = toFinanceData(raw, today);
    return { raw, data, analysis: analyze(data, raw.overrides, today), today };
  },
);

/** True when the user hasn't accepted the current privacy policy version. */
export const needsPrivacyConsent = cache(async (): Promise<boolean> => {
  const { supabase } = await requireUser();
  const { PRIVACY_VERSION } = await import("@/lib/legal");
  const { data } = await supabase
    .from("consents")
    .select("id")
    .eq("kind", "privacy_policy")
    .eq("version", PRIVACY_VERSION)
    .eq("granted", true)
    .limit(1);
  return !data?.length;
});
