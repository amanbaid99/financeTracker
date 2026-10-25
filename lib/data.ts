import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { todayIST } from "@/lib/dates";
import { PRIVACY_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";
import { trackGoal, type Investment, type Link, type TrackedGoal } from "@/lib/tracker";

/** The signed-in user, or a redirect to /login. Cached per request. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
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
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const loadGoals = cache(async (): Promise<GoalsData> => {
  const { supabase, user } = await requireUser();
  const [goals, holdings, allocations, profile] = await Promise.all([
    supabase
      .from("goals")
      .select("id, name, target_today, target_date, inflation_rate, created_at")
      .order("created_at"),
    supabase
      .from("holdings")
      .select("id, kind, name, category, current_value, monthly_sip, expected_return_pct")
      .order("current_value", { ascending: false }),
    supabase.from("goal_allocations").select("goal_id, holding_id, percent"),
    supabase.from("profiles").select("theme, accent").eq("user_id", user.id).maybeSingle(),
  ]);
  const today = todayIST();
  const investments: Investment[] = check(holdings).map((h) => ({
    id: h.id,
    kind: h.kind,
    name: h.name,
    category: h.category,
    value: h.current_value,
    monthlySip: h.monthly_sip ?? 0,
    returnPct: h.expected_return_pct === null ? null : Number(h.expected_return_pct),
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
        target: g.target_today,
        targetDate: g.target_date,
        inflationPct: g.inflation_rate === null ? null : Number(g.inflation_rate),
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
  };
});
