import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Card, Period } from "@/lib/cards";
import { pendingReleases, type Release } from "@/lib/guides";
import { todayIST } from "@/lib/dates";
import { PRIVACY_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";
import {
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

/** True when the user hasn't accepted the current privacy policy version. */
export const needsPrivacyConsent = cache(async (): Promise<boolean> => {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("consents")
    .select("id")
    .eq("kind", "privacy_policy")
    .eq("version", PRIVACY_VERSION)
    .eq("granted", true)
    .limit(1);
  return !data?.length;
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
  const { supabase, user } = await requireUser();
  const [goals, holdings, allocations, profile, bills] = await Promise.all([
    supabase
      .from("goals")
      .select(
        "id, name, type, target_today, target_date, inflation_rate, created_at, loan_outstanding, loan_emi, loan_rate, loan_months_left, loan_as_of, loan_foreclosure_pct, loan_foreclosure_gst, loan_emi_day, loan_first_emi",
      )
      .order("created_at"),
    supabase
      .from("holdings")
      .select(
        "id, kind, name, category, current_value, monthly_sip, expected_return_pct, invested",
      )
      .order("current_value", { ascending: false }),
    supabase.from("goal_allocations").select("goal_id, holding_id, percent"),
    supabase
      .from("profiles")
      .select("theme, accent, plan_lump_sum, plan_monthly")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("goal_bills")
      .select("id, goal_id, name, amount, every_months, next_due")
      .order("next_due"),
  ]);
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
        loan:
          g.type === "loan_payoff" && g.loan_outstanding !== null
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
    const { supabase } = await requireUser();
    const [cards, milestones, bills] = await Promise.all([
      supabase
        .from("credit_cards")
        .select(
          "id, label, annual_fee, year_start, rewards, benefits, best_for, unbilled, unbilled_as_of, created_at",
        )
        .order("created_at"),
      supabase
        .from("card_milestones")
        .select(
          "id, card_id, name, target, period, deadline, reward, created_at",
        )
        .order("created_at"),
      supabase
        .from("card_bills")
        .select("id, card_id, month, amount, due_date, paid, note")
        .order("month", { ascending: false })
        .limit(500),
    ]);
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
        unbilled: c.unbilled,
        unbilledAsOf: c.unbilled_as_of,
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
    const { supabase, user } = await requireUser();
    // When someone joined: their first privacy acceptance, made at sign-up.
    const [settings, joined] = await Promise.all([
      supabase
        .from("settings")
        .select("seen_guides, whats_new_seen")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("consents")
        .select("created_at")
        .eq("kind", "privacy_policy")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
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
