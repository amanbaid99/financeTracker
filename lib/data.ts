import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Card, Period } from "@/lib/cards";
import { budget, type Cost, type Income } from "@/lib/budget";
import { loanInput, loanView, type Loan, type LoanType } from "@/lib/loans";
import { pendingReleases, type Release } from "@/lib/guides";
import { todayIST } from "@/lib/dates";
import { PRIVACY_VERSION } from "@/lib/legal";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { planMoney } from "@/lib/allocate";
import type { NetWorthPoint } from "@/components/net-worth-card";
import {
  freePercent,
  trackGoal,
  type Investment,
  type Link,
  type TrackedGoal,
} from "@/lib/tracker";

/**
 * The signed-in user, or a redirect to /login. Cached per request.
 *
 * Reads the verified sign-in token (checked locally against Supabase's
 * signing keys, so no extra network call), the same check the proxy makes.
 * Every query still goes through row level security with this token.
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  return {
    supabase,
    user: {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
    },
  };
});

type Row<T extends keyof Database["public"]["Tables"]> = Tables<T>;

/**
 * Everything the signed-in pages show, from one database call
 * (`app_snapshot`, which runs under row level security). Cached per request,
 * so the layout and the page share it.
 */
export interface Snapshot {
  goals: Pick<
    Row<"goals">,
    | "id"
    | "name"
    | "type"
    | "target_today"
    | "target_date"
    | "inflation_rate"
    | "created_at"
    | "loan_id"
    | "loan_outstanding"
    | "loan_emi"
    | "loan_rate"
    | "loan_months_left"
    | "loan_as_of"
    | "loan_foreclosure_pct"
    | "loan_foreclosure_gst"
    | "loan_emi_day"
    | "loan_first_emi"
    | "priority"
  >[];
  holdings: Pick<
    Row<"holdings">,
    | "id"
    | "kind"
    | "name"
    | "category"
    | "current_value"
    | "monthly_sip"
    | "expected_return_pct"
    | "invested"
    | "updated_at"
  >[];
  allocations: Pick<
    Row<"goal_allocations">,
    "goal_id" | "holding_id" | "percent"
  >[];
  goal_bills: Pick<
    Row<"goal_bills">,
    "id" | "goal_id" | "name" | "amount" | "every_months" | "next_due"
  >[];
  loans: Pick<
    Row<"loans">,
    | "id"
    | "name"
    | "type"
    | "card_id"
    | "principal"
    | "taken_on"
    | "rate"
    | "emi"
    | "months_left"
    | "total_emis"
    | "emi_day"
    | "bill_day"
    | "first_emi"
    | "outstanding"
    | "outstanding_as_of"
    | "foreclosure_pct"
    | "foreclosure_gst"
  >[];
  loan_payments: Pick<
    Row<"loan_payments">,
    "loan_id" | "due_date" | "amount" | "paid_on"
  >[];
  incomes: Pick<
    Row<"income_streams">,
    "id" | "label" | "type" | "amount_monthly" | "active"
  >[];
  expenses: Pick<Row<"expenses">, "id" | "category" | "amount_monthly">[];
  cards: Pick<
    Row<"credit_cards">,
    | "id"
    | "label"
    | "annual_fee"
    | "year_start"
    | "rewards"
    | "benefits"
    | "best_for"
    | "created_at"
  >[];
  card_milestones: Pick<
    Row<"card_milestones">,
    | "id"
    | "card_id"
    | "name"
    | "target"
    | "period"
    | "deadline"
    | "reward"
    | "created_at"
  >[];
  card_bills: Pick<
    Row<"card_bills">,
    "id" | "card_id" | "month" | "amount" | "due_date" | "paid" | "note"
  >[];
  profile: Pick<
    Row<"profiles">,
    | "theme"
    | "accent"
    | "plan_lump_sum"
    | "plan_monthly"
    | "ai_enabled"
    | "age"
    | "dob"
    | "dependents"
    | "sole_earner"
  > | null;
  settings: Pick<
    Row<"settings">,
    "seen_guides" | "whats_new_seen" | "last_cas_import_at"
  > | null;
  review: Row<"portfolio_reviews"> | null;
  privacy_ok: boolean;
  joined_at: string | null;
  is_admin: boolean;
  ai_consent: { granted: boolean; version: string } | null;
}

export const loadSnapshot = cache(async (): Promise<Snapshot> => {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("app_snapshot", {
    privacy_version: PRIVACY_VERSION,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Snapshot;
});

/** True when the user hasn't accepted the current privacy policy version. */
export const needsPrivacyConsent = cache(async (): Promise<boolean> => {
  return !(await loadSnapshot()).privacy_ok;
});

export interface GoalsData {
  goals: TrackedGoal[];
  investments: Investment[];
  links: Link[];
  today: string;
  theme: string;
  accent: string;
  /** Money plan: savings to put toward goals now, and total monthly investing. Null until set. */
  plan: { lump: number; monthly: number } | null;
}

function check<T>(res: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function readGoals(): Promise<GoalsData> {
  const [snap, loans] = await Promise.all([loadSnapshot(), loadLoans()]);
  const goals = { data: snap.goals, error: null };
  const holdings = { data: snap.holdings, error: null };
  const allocations = { data: snap.allocations, error: null };
  const profile = { data: snap.profile };
  const bills = { data: snap.goal_bills, error: null };
  const loanById = new Map(loans.map((l) => [l.id, l]));
  const billRows = check(bills);
  const today = todayIST();
  const investments: Investment[] = check(holdings).map((h) => ({
    id: h.id,
    kind: h.kind,
    name: h.name,
    category: h.category,
    value: h.current_value,
    monthlySip: h.monthly_sip ?? 0,
    returnPct:
      h.expected_return_pct === null ? null : Number(h.expected_return_pct),
    invested: h.invested,
    updatedAt: h.updated_at,
  }));
  const links: Link[] = check(allocations).map((a) => ({
    goalId: a.goal_id,
    investmentId: a.holding_id,
    percent: Number(a.percent),
  }));
  const tracked = check(goals).map((g) =>
    trackGoal(
      {
        id: g.id,
        name: g.name,
        type: g.type,
        target: g.target_today,
        targetDate: g.target_date,
        inflationPct:
          g.inflation_rate === null ? null : Number(g.inflation_rate),
        loanId: g.loan_id,
        niceToHave: (g.priority ?? 3) >= 4,
        // A linked loan is the source of truth; older goals kept their own copy.
        loan:
          g.type === "loan_payoff" && g.loan_id && loanById.has(g.loan_id)
            ? loanInput(loanById.get(g.loan_id)!)
            : g.type === "loan_payoff" && g.loan_outstanding !== null
              ? {
                  outstanding: g.loan_outstanding,
                  emi: g.loan_emi,
                  ratePct: Number(g.loan_rate ?? 0),
                  monthsLeft: g.loan_months_left,
                  asOf: g.loan_as_of ?? g.created_at.slice(0, 10),
                  foreclosurePct:
                    g.loan_foreclosure_pct === null
                      ? null
                      : Number(g.loan_foreclosure_pct),
                  foreclosureGst: g.loan_foreclosure_gst,
                  emiDay: g.loan_emi_day,
                  firstEmi: g.loan_first_emi,
                }
              : null,
        bills:
          g.type === "bills_fund"
            ? billRows
                .filter((b) => b.goal_id === g.id)
                .map((b) => ({
                  id: b.id,
                  name: b.name,
                  amount: b.amount,
                  everyMonths: b.every_months,
                  nextDue: b.next_due,
                }))
            : null,
      },
      investments,
      links,
      today,
    ),
  );
  return {
    goals: tracked,
    investments,
    links,
    today,
    theme: profile.data?.theme ?? "white",
    accent: profile.data?.accent ?? "green",
    plan:
      profile.data &&
      (profile.data.plan_lump_sum !== null ||
        profile.data.plan_monthly !== null)
        ? {
            lump: profile.data.plan_lump_sum ?? 0,
            monthly: profile.data.plan_monthly ?? 0,
          }
        : null,
  };
}

export const loadGoals = cache(readGoals);

/** The user's credit cards with their milestones. */
export const loadCards = cache(
  async (): Promise<{ cards: Card[]; today: string }> => {
    const snap = await loadSnapshot();
    const cards = { data: snap.cards, error: null };
    const milestones = { data: snap.card_milestones, error: null };
    const bills = { data: snap.card_bills, error: null };
    const ms = check(milestones);
    const bs = check(bills);
    return {
      today: todayIST(),
      cards: check(cards).map((c) => ({
        id: c.id,
        label: c.label,
        annualFee: c.annual_fee,
        yearStart: c.year_start,
        rewards: c.rewards,
        benefits: c.benefits ?? [],
        bestFor: c.best_for ?? [],
        milestones: ms
          .filter((m) => m.card_id === c.id)
          .map((m) => ({
            id: m.id,
            name: m.name,
            target: m.target,
            period: m.period as Period,
            deadline: m.deadline,
            reward: m.reward,
            createdAt: m.created_at,
          })),
        bills: bs
          .filter((b) => b.card_id === c.id)
          .map((b) => ({
            id: b.id,
            month: b.month,
            amount: b.amount,
            dueDate: b.due_date,
            paid: b.paid,
            note: b.note,
          })),
      })),
    };
  },
);

/** Which guides this person has seen and which launches they haven't read. */
export const loadOnboarding = cache(
  async (): Promise<{ seenGuides: string[]; releases: Release[] }> => {
    const snap = await loadSnapshot();
    // When someone joined: their first privacy acceptance, made at sign-up.
    const settings = { data: snap.settings };
    const joined = {
      data: snap.joined_at ? { created_at: snap.joined_at } : null,
    };
    const data = settings.data;
    return {
      seenGuides: data?.seen_guides ?? [],
      releases: pendingReleases(
        data?.whats_new_seen ?? null,
        joined.data?.created_at ?? new Date().toISOString(),
      ),
    };
  },
);

/** Every loan with its marked payments and the goal saving to close it. */
export const loadLoans = cache(async (): Promise<Loan[]> => {
  const snap = await loadSnapshot();
  const loans = { data: snap.loans, error: null };
  const payments = { data: snap.loan_payments, error: null };
  const goals = {
    data: snap.goals
      .filter((g) => g.loan_id)
      .map((g) => ({ id: g.id, name: g.name, loan_id: g.loan_id })),
    error: null,
  };
  const ps = check(payments);
  const gs = check(goals);
  return check(loans).map((l) => {
    const g = gs.find((x) => x.loan_id === l.id);
    return {
      id: l.id,
      name: l.name,
      type: l.type as LoanType,
      cardId: l.card_id,
      principal: l.principal,
      takenOn: l.taken_on,
      ratePct: Number(l.rate),
      emi: l.emi,
      monthsLeft: l.months_left,
      totalEmis: l.total_emis,
      emiDay: l.emi_day,
      billDay: l.bill_day,
      firstEmi: l.first_emi,
      outstanding: l.outstanding,
      asOf: l.outstanding_as_of,
      foreclosurePct:
        l.foreclosure_pct === null ? null : Number(l.foreclosure_pct),
      foreclosureGst: l.foreclosure_gst,
      payments: ps
        .filter((p) => p.loan_id === l.id)
        .map((p) => ({
          dueDate: p.due_date,
          amount: p.amount,
          paidOn: p.paid_on,
        })),
      goal: g ? { id: g.id, name: g.name } : null,
    };
  });
});

/** Money in and money out for the budget, plus EMIs and SIPs from the app. */
export const loadBudget = cache(async () => {
  const [snap, loans, goals] = await Promise.all([
    loadSnapshot(),
    loadLoans(),
    loadGoals(),
  ]);
  const incomes = { data: snap.incomes, error: null };
  const costs = { data: snap.expenses, error: null };
  const today = goals.today;
  const loanEmis = loans
    .map((l) => ({ name: l.name, view: loanView(l, today) }))
    .filter((x) => !x.view.closed && x.view.state.emi > 0)
    .map((x) => ({ name: x.name, emi: x.view.state.emi }));
  const incomeRows: Income[] = check(incomes).map((i) => ({
    id: i.id,
    label: i.label,
    type: i.type,
    amount: i.amount_monthly,
    active: i.active,
  }));
  const costRows: Cost[] = check(costs).map((c) => ({
    id: c.id,
    name: c.category,
    amount: c.amount_monthly,
  }));
  const sips = goals.investments.reduce((s, i) => s + i.monthlySip, 0);
  return {
    incomes: incomeRows,
    costs: costRows,
    loanEmis,
    sips,
    plan: goals.plan,
    budget: budget({
      incomes: incomeRows,
      costs: costRows,
      emis: loanEmis.reduce((s, l) => s + l.emi, 0),
      sips,
    }),
  };
});

/** The money plan as Goals and the plan page show it, worked out once. */
export const loadMoneyPlan = cache(async () => {
  const [g, b] = await Promise.all([loadGoals(), loadBudget()]);
  const { goals, investments, links, today, plan: input } = g;
  const sipsNow = investments.reduce((s, i) => s + i.monthlySip, 0);
  const unassigned = Math.round(
    investments.reduce(
      (s, i) => s + (i.value * freePercent(i.id, links)) / 100,
      0,
    ),
  );
  const plan = input
    ? planMoney({
        goals,
        investments,
        links,
        lump: input.lump,
        monthlyTotal: input.monthly,
        todayISO: today,
        essentialsMonthly: b.budget.costs + b.budget.emis,
      })
    : null;
  return {
    ...g,
    budget: b.budget,
    plan,
    planInput: input,
    sipsNow,
    unassigned,
    budgetMonthly: b.budget.income > 0 ? b.budget.planMonthly : null,
  };
});

/**
 * Net worth over time. The database keeps a row per day whenever a holding
 * or loan changes; today's point uses the live figures (loan balances follow
 * their EMI schedule even before you update them).
 */
export const loadNetWorth = cache(async () => {
  const [{ supabase }, goals, loans, { cards }] = await Promise.all([
    requireUser(),
    loadGoals(),
    loadLoans(),
    loadCards(),
  ]);
  const { data } = await supabase
    .from("net_worth_history")
    .select("day, assets, liabilities, card_bills")
    .order("day", { ascending: true })
    .limit(800);
  const today = goals.today;
  const assets = Math.round(goals.investments.reduce((s, i) => s + i.value, 0));
  const loanTotal = Math.round(
    loans.reduce(
      (s, l) => s + Math.max(0, loanView(l, today).state.balance),
      0,
    ),
  );
  // Unpaid card statements are debts until they're paid.
  const cardBills = cards
    .flatMap((c) => c.bills)
    .filter((b) => !b.paid)
    .reduce((s, b) => s + b.amount, 0);
  const history: NetWorthPoint[] = (data ?? [])
    .filter((r) => r.day < today)
    .map((r) => ({
      day: r.day,
      assets: Number(r.assets),
      liabilities: Number(r.liabilities),
      cardBills: Number(r.card_bills),
    }));
  history.push({
    day: today,
    assets,
    liabilities: loanTotal + cardBills,
    cardBills,
  });
  return { history, assets, liabilities: loanTotal + cardBills };
});
