import { loadHybridContext } from "./hybrid-data";
import { readGoalPlanning, readHoldingPlanning } from "./hybrid-settings";
import { hybridMoneyPlan } from "./hybrid-plan";
import {
  monthlyCapacity,
  calculateHybrid,
  unallocatedLiquidValue,
} from "./hybrid-engine";
import {savedBudgetInputs} from "./planner-budget";
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
import { betweenJobs, runway, type RunwayItem } from "@/lib/runway";
import type { NetWorthPoint } from "@/components/net-worth-card";
import {
  freePercent,
  trackGoal,
  type GoalInput,
  type Investment,
  type Link,
  type TrackedGoal,
} from "@/lib/tracker";
import { loadSipMinimums } from "./sip-minimums-data";
import { autoAllocate, type AutoAllocation } from "@/lib/auto-allocate";

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
    | "plan_rank"
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
    | "isin"
    | "units"
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
    | "balance_confirmed_on"
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
    | "statement_day"
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
    | "salary_best"
    | "salary_worst"
    | "runway_choices"
  > | null;
  runway_items: Pick<
    Row<"runway_items">,
    "id" | "kind" | "label" | "amount" | "due" | "done" | "created_at"
  >[];
  settings: Pick<
    Row<"settings">,
    "seen_guides" | "whats_new_seen" | "last_cas_import_at" | "update_snoozes"
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
  /** How your money is split across goals, worked out automatically. */
  allocation: AutoAllocation;
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
  const [snap, loans,hybridContext] = await Promise.all([loadSnapshot(), loadLoans(),loadHybridContext()]);
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
    // Older snapshots (before the units migration) don't carry these.
    isin: h.isin ?? null,
    units: h.units == null ? null : Number(h.units),
    ...readHoldingPlanning(
      hybridContext.holdingDetails.find((d) => d.id === h.id)?.planning_details,
    ),
  }));
  // Old hand-made links (goal_allocations) are no longer used: which money
  // covers which goal is worked out automatically (lib/auto-allocate.ts).
  void allocations;
  const inputs: GoalInput[] = check(goals).map((g): GoalInput => ({
    id: g.id,
    name: g.name,
    type: g.type,
    target: g.target_today,
    targetDate: g.target_date,
    inflationPct: g.inflation_rate === null ? null : Number(g.inflation_rate),
    loanId: g.loan_id,
    niceToHave: (g.priority ?? 3) >= 4,
    planRank: g.plan_rank ?? null,
    priorityLevel:
      (g.priority ?? 3) <= 2
        ? "high"
        : (g.priority ?? 3) >= 4
          ? "low"
          : "medium",
    completed:
      hybridContext.goalSettings.find((d) => d.id === g.id)?.status ===
      "completed",
    ...readGoalPlanning(
      hybridContext.goalSettings.find((d) => d.id === g.id)?.planning_settings,
    ),
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
  }));
  const bare = inputs.map((g) => trackGoal(g, investments, [], today));
  let allocation = autoAllocate(bare, investments, today);
  // Saved mappings (a confirmed plan, or a suggestion you accepted on Goals)
  // decide which money covers which goal; otherwise it's worked out for you.
  const useSaved = hybridContext.plans.length > 0 || check(allocations).length > 0;
  const links = useSaved
    ? check(allocations)
        .map((a) => ({
          goalId: a.goal_id,
          investmentId: a.holding_id,
          percent: Number(a.percent),
        }))
        .filter((l) => inputs.some((g) => g.id === l.goalId && !g.completed))
    : allocation.links
        .map((l) => ({ ...l, percent: Math.floor(l.percent * 100) / 100 }))
        .filter((l) => l.percent > 0);
  if (useSaved) {
    const coverage = calculateHybrid({
      today,
      goals: inputs,
      investments,
      links,
      monthlySavings: 0,
    });
    allocation = {
      ...allocation,
      links,
      covers: Object.fromEntries(
        coverage.goals.map((g) => [
          g.goalId,
          {
            goalId: g.goalId,
            taken: g.existingCoverage,
            short: g.fundingGap,
            byPool: {},
            why: "Your confirmed proportional ownership.",
          },
        ]),
      ),
      spare: {},
      spareTotal: coverage.unallocatedInvestments.reduce(
        (sum, i) => sum + i.value,
        0,
      ),
    };
  }
  const tracked = inputs.map((g) => {
    const c = allocation.covers[g.id];
    return {
      ...trackGoal(g, investments, links, today),
      confirmedMapping: useSaved,
      cover: c && { taken: c.taken, short: c.short, why: c.why },
    };
  });
  return {
    goals: tracked,
    investments,
    links,
    allocation,
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
        statementDay: c.statement_day,
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
      confirmedOn: l.balance_confirmed_on,
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
/** A saved budget is the source for planning, regardless of how it was created. */
const loadSavedSheet = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("budget_ratio_plans")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle();
  if(error)throw Error("Your saved budget could not be loaded. Reload before planning SIPs.");
  return data?.plan??null;
});

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
    .map((l) => ({ id: l.id, name: l.name, view: loanView(l, today) }))
    .filter((x) => !x.view.closed && x.view.state.emi > 0)
    .map((x) => ({ id: x.id, name: x.name, emi: x.view.state.emi }));
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
  // One source of truth: once a budget sheet is saved, its income and
  // expenses are what Your plan and Covered till salary use. Loan rows count
  // once, with the budget's confirmed inclusions. Older records are a fallback only before setup.
  const fromSheet = savedBudgetInputs(await loadSavedSheet(),loanEmis);
  return {
    /** The income and cost records, for filling a new budget sheet. */
    recordCosts: costRows,
    recordIncome: incomeRows
      .filter((i) => i.active)
      .reduce((s, i) => s + i.amount, 0),
    incomes: fromSheet?.incomes ?? incomeRows,
    costs: fromSheet?.costs ?? costRows,
    loanEmis,
    sips,
    plan: goals.plan,
    budget: budget({
      incomes: fromSheet?.incomes ?? incomeRows,
      costs: fromSheet?.costs ?? costRows,
      emis: fromSheet?.emis ?? loanEmis.reduce((s, l) => s + l.emi, 0),
      sips,
    }),
  };
});

/** The money plan as Goals and the plan page show it, worked out once. */
export const loadMoneyPlan = cache(async () => {
  const [g, b, minimums] = await Promise.all([
    loadGoals(),
    loadBudget(),
    loadSipMinimums(),
  ]);
  const { goals, investments, links, today, plan: input } = g;
  const sipsNow = investments.reduce((s, i) => s + i.monthlySip, 0);
  const unassigned = Math.round(
    investments.reduce(
      (s, i) => s + (i.value * freePercent(i.id, links)) / 100,
      0,
    ),
  );
  const context = await loadHybridContext();
  const priorBuffer = (
    context.plans[0]?.inputs as { cashBuffer?: number } | undefined
  )?.cashBuffer;
  const capacity = monthlyCapacity(
    b.budget.income,
    b.budget.costs,
    b.budget.emis,
    Number.isSafeInteger(priorBuffer) && priorBuffer! >= 0 ? priorBuffer : 0,
  );
  const plan = input
    ? hybridMoneyPlan({
        goals,
        investments,
        links,
        riskTolerance: context.riskTolerance,
        oneTime: Math.min(
          input.lump,
          unallocatedLiquidValue(investments, links, today),
        ),
        monthlySavings: capacity.availableSavings,
        monthlyPlanLimit: Math.min(input.monthly, capacity.availableSavings),
        budgetDeficit: capacity.budgetDeficit,
        today,
        minimums,
      })
    : null;
  return {
    ...g,
    goals: goals.map((goal) => {
      const funding = plan?.hybrid?.goals.find((f) => f.goalId === goal.id);
      return funding
        ? {
            ...goal,
            funding,
            current: funding.existingCoverage,
            futureTarget: funding.targetCorpus,
            progress: funding.targetCorpus
              ? Math.min(1, funding.existingCoverage / funding.targetCorpus)
              : 1,
            projected: funding.projectedCorpus,
            extraSipNeeded: funding.monthlyShortfall,
            status:
              goal.completed || funding.status === "fully_funded"
                ? ("reached" as const)
                : funding.status === "on_track"
                  ? ("on_track" as const)
                  : ("behind" as const),
          }
        : goal;
    }),
    budget: b.budget,
    plan,
    planInput: input,
    sipsNow,
    unassigned,
    budgetMonthly: b.budget.income > 0 ? b.budget.planMonthly : null,
  };
});

/** Current balances only. No performance history or market-price fetch. */
export const loadCurrentNetWorth = cache(async () => {
  const [g, loans] = await Promise.all([loadGoals(), loadLoans()]);
  return {
    assets: Math.round(g.investments.reduce((sum, i) => sum + i.value, 0)),
    liabilities: Math.round(
      loans.reduce(
        (sum, l) => sum + Math.max(0, loanView(l, g.today).state.balance),
        0,
      ),
    ),
  };
});

/**
 * Net worth over time: holdings minus loans. Card statements are logged for
 * milestones only, so they don't count. The database keeps a row per day whenever a holding
 * or loan changes; today's point uses the live figures (loan balances follow
 * their EMI schedule even before you update them).
 */
export const loadNetWorth = cache(async () => {
  const [{ supabase }, goals, loans] = await Promise.all([
    requireUser(),
    loadGoals(),
    loadLoans(),
  ]);
  const { data } = await supabase
    .from("net_worth_history")
    .select("day, assets, liabilities")
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
  const history: NetWorthPoint[] = (data ?? [])
    .filter((r) => r.day < today)
    .map((r) => ({
      day: r.day,
      assets: Number(r.assets),
      liabilities: Number(r.liabilities),
    }));
  history.push({
    day: today,
    assets,
    liabilities: loanTotal,
  });
  return { history, assets, liabilities: loanTotal };
});

/** Between jobs and "Covered till salary", worked out once per request. */
export const loadRunway = cache(async () => {
  const [snap, g, loans, b] = await Promise.all([
    loadSnapshot(),
    loadGoals(),
    loadLoans(),
    loadBudget(),
  ]);
  const p = snap.profile;
  const items: RunwayItem[] = (snap.runway_items ?? []).map((i) => ({
    id: i.id,
    kind: i.kind as RunwayItem["kind"],
    label: i.label,
    amount: i.amount,
    due: i.due,
    done: i.done,
  }));
  const active = betweenJobs(p, g.today);
  const bills = g.goals.flatMap((goal) =>
    (goal.billsFund?.upcoming ?? []).map((e) => ({
      goalId: goal.id,
      name: e.name,
      amount: e.amount,
      date: e.date,
    })),
  );
  const result =
    p?.salary_best && p.salary_worst
      ? runway({
          today: g.today,
          salaryBest: p.salary_best,
          salaryWorst: p.salary_worst,
          investments: g.investments,
          loans,
          monthlyLiving: b.budget.costs,
          bills,
          // One-off payments and money owed were removed on 17 Nov 2026.
          items: [],
          choices: (p?.runway_choices as Record<string, boolean>) ?? {},
        })
      : null;
  return {
    active,
    salaryBest: p?.salary_best ?? null,
    salaryWorst: p?.salary_worst ?? null,
    runway: result,
    items,
    today: g.today,
    monthlyLiving: b.budget.costs,
    bills,
    choices: (p?.runway_choices as Record<string, boolean>) ?? {},
  };
});
