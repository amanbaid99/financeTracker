"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addMonths, lastEmiOnOrBefore, todayIST } from "@/lib/dates";
import { GOAL_TYPES, type GoalType } from "@/lib/goal-types";
import { PRIVACY_VERSION } from "@/lib/legal";
import { categoryFor, FUND_CATEGORIES, KINDS } from "@/lib/instruments";
import { createClient } from "@/lib/supabase/server";
import {
  ACCENT_COOKIE,
  ACCENTS,
  THEME_COOKIE,
  THEME_COOKIE_OPTIONS,
  THEMES,
} from "@/lib/theme";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const money = z.number().int().min(0).max(1e13);
const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pick a date");

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, userId: data.user.id };
}

function fail(e: unknown): ActionResult {
  if (e instanceof z.ZodError) {
    const first = e.issues[0];
    return {
      ok: false,
      error: `Check ${first.path.join(" ") || "your input"}: ${first.message}`,
    };
  }
  return {
    ok: false,
    error: e instanceof Error ? e.message : "Something went wrong",
  };
}

function done(id?: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

const goalTypes = GOAL_TYPES.map((t) => t.value) as [GoalType, ...GoalType[]];

const goalSchema = z
  .object({
    id: uuid.nullable().optional(),
    type: z.enum(goalTypes),
    name: z.string().trim().min(1, "name your goal").max(60),
    target: money,
    targetDate: isoDate.nullable(),
    inflationPct: z.number().min(0).max(20).nullable(),
    loan: z
      .object({
        outstanding: money.min(1, "add what you still owe"),
        emi: money.nullable(),
        ratePct: z.number().min(0).max(60),
        monthsLeft: z.number().int().min(1).max(600).nullable(),
        /** Day of the month the EMI is paid. */
        emiDay: z.number().int().min(1).max(31),
        /**
         * Set when entering the loan from its start: `outstanding` is the
         * original amount and `monthsLeft` the full tenure.
         */
        firstEmi: isoDate.nullable().optional(),
        foreclosurePct: z.number().min(0).max(20).nullable().optional(),
        foreclosureGst: z.boolean().optional(),
      })
      .nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "loan_payoff") {
      if (!v.loan)
        ctx.addIssue({
          code: "custom",
          path: ["loan"],
          message: "add the loan details",
        });
      else if (!v.loan.emi && !v.loan.monthsLeft)
        ctx.addIssue({
          code: "custom",
          path: ["EMI"],
          message: "add the EMI or the months left",
        });
    } else if (v.target < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["target"],
        message: "add a target amount",
      });
    }
  });

export async function saveGoal(
  input: z.input<typeof goalSchema>,
): Promise<ActionResult> {
  try {
    const v = goalSchema.parse(input);
    const { supabase, userId } = await session();
    const loan = v.type === "loan_payoff" ? v.loan : null;
    const row = {
      name: v.name,
      type: v.type,
      target_today: loan ? loan.outstanding : v.target,
      target_date: v.targetDate,
      inflation_rate: loan ? null : v.inflationPct,
      loan_outstanding: loan?.outstanding ?? null,
      loan_emi: loan?.emi ?? null,
      loan_rate: loan?.ratePct ?? null,
      loan_months_left: loan?.monthsLeft ?? null,
      loan_foreclosure_pct: loan?.foreclosurePct ?? null,
      loan_foreclosure_gst: loan?.foreclosureGst ?? true,
      // From the start: the balance is the original amount just before the
      // first EMI. Otherwise it's what's owed after the latest EMI.
      loan_as_of: loan
        ? loan.firstEmi
          ? addMonths(loan.firstEmi, -1)
          : lastEmiOnOrBefore(todayIST(), loan.emiDay)
        : null,
      loan_emi_day: loan?.emiDay ?? null,
      loan_first_emi: loan?.firstEmi ?? null,
    };
    const res = v.id
      ? await supabase
          .from("goals")
          .update(row)
          .eq("id", v.id)
          .eq("user_id", userId)
          .select("id")
          .single()
      : await supabase
          .from("goals")
          .insert({ ...row, user_id: userId, priority: 3, saved_amount: 0 })
          .select("id")
          .single();
    if (res.error) throw new Error(res.error.message);
    return done(res.data.id);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  try {
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("goals")
      .delete()
      .eq("id", uuid.parse(id))
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Investments
// ---------------------------------------------------------------------------

const fundValues = FUND_CATEGORIES.map((c) => c.value) as [string, ...string[]];

const investmentSchema = z.object({
  /** The goal this investment is being added to or edited from, if any. */
  goalId: uuid.nullable(),
  /** Existing investment to edit or link; null creates a new one. */
  investmentId: uuid.nullable(),
  kind: z.enum(KINDS),
  fundCategory: z.enum(fundValues).nullable(),
  name: z.string().trim().max(80).nullable(),
  value: money,
  monthlySip: money,
  returnPct: z.number().min(0).max(30).nullable(),
  /** Share of this investment for the goal, 1 to 100. */
  percent: z.number().min(1, "use at least 1%").max(100),
  /** Recorded from a money plan suggestion: its value comes out of the plan's savings. */
  fromPlan: z.boolean().optional(),
});

export async function saveInvestment(
  input: z.input<typeof investmentSchema>,
): Promise<ActionResult> {
  try {
    const v = investmentSchema.parse(input);
    const { supabase, userId } = await session();

    if (v.goalId && v.investmentId) {
      // An investment can be split across goals, but never past 100%.
      const { data, error } = await supabase
        .from("goal_allocations")
        .select("goal_id, percent")
        .eq("holding_id", v.investmentId);
      if (error) throw new Error(error.message);
      const used = (data ?? [])
        .filter((a) => a.goal_id !== v.goalId)
        .reduce((s, a) => s + Number(a.percent), 0);
      if (used + v.percent > 100.001) {
        return {
          ok: false,
          error: `Only ${Math.max(0, Math.round(100 - used))}% of this investment is free. The rest is used by other goals.`,
        };
      }
    }

    const row = {
      kind: v.kind,
      name: v.name || null,
      category: categoryFor(v.kind, v.fundCategory),
      current_value: v.value,
      monthly_sip: v.monthlySip || null,
      expected_return_pct: v.returnPct,
    };
    const res = v.investmentId
      ? await supabase
          .from("holdings")
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq("id", v.investmentId)
          .eq("user_id", userId)
          .select("id")
          .single()
      : await supabase
          .from("holdings")
          .insert({ ...row, user_id: userId })
          .select("id")
          .single();
    if (res.error) throw new Error(res.error.message);
    const investmentId = res.data.id;

    if (v.goalId) {
      // Update an existing link in place: the database's 100% check would
      // otherwise count the old row too.
      const { data: updated, error: updError } = await supabase
        .from("goal_allocations")
        .update({ percent: v.percent })
        .eq("goal_id", v.goalId)
        .eq("holding_id", investmentId)
        .eq("user_id", userId)
        .select("id");
      if (updError) throw new Error(updError.message);
      if (!updated?.length) {
        const { error } = await supabase
          .from("goal_allocations")
          .insert({
            user_id: userId,
            goal_id: v.goalId,
            holding_id: investmentId,
            percent: v.percent,
          });
        if (error) throw new Error(error.message);
      }
    }
    if (v.fromPlan && !v.investmentId && v.value > 0) {
      const { data: p } = await supabase
        .from("profiles")
        .select("plan_lump_sum")
        .eq("user_id", userId)
        .single();
      if (p?.plan_lump_sum) {
        const { error } = await supabase
          .from("profiles")
          .update({ plan_lump_sum: Math.max(0, p.plan_lump_sum - v.value) })
          .eq("user_id", userId);
        if (error) throw new Error(error.message);
      }
    }
    return done(investmentId);
  } catch (e) {
    return fail(e);
  }
}

const planSchema = z.object({ lump: money, monthly: money });

/** Saves what the user can put toward goals; null clears the plan. */
export async function savePlan(
  input: z.input<typeof planSchema> | null,
): Promise<ActionResult> {
  try {
    const v = input === null ? null : planSchema.parse(input);
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("profiles")
      .update({
        plan_lump_sum: v?.lump ?? null,
        plan_monthly: v?.monthly ?? null,
      })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

/** Takes an investment off a goal; the investment itself stays. */
export async function removeFromGoal(input: {
  goalId: string;
  investmentId: string;
}): Promise<ActionResult> {
  try {
    const v = z.object({ goalId: uuid, investmentId: uuid }).parse(input);
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("goal_allocations")
      .delete()
      .eq("goal_id", v.goalId)
      .eq("holding_id", v.investmentId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

const valuesSchema = z
  .array(z.object({ id: uuid, value: money }))
  .min(1)
  .max(200);

/** Saves new values for several investments at once. */
export async function updateValues(
  input: z.input<typeof valuesSchema>,
): Promise<ActionResult> {
  try {
    const rows = valuesSchema.parse(input);
    const { supabase, userId } = await session();
    const now = new Date().toISOString();
    for (const r of rows) {
      const { error } = await supabase
        .from("holdings")
        .update({ current_value: r.value, updated_at: now })
        .eq("id", r.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteInvestment(id: string): Promise<ActionResult> {
  try {
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("holdings")
      .delete()
      .eq("id", uuid.parse(id))
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Look, consent and account
// ---------------------------------------------------------------------------

const themeSchema = z.object({
  theme: z.enum(THEMES),
  accent: z.enum(ACCENTS),
});

export async function saveTheme(
  input: z.input<typeof themeSchema>,
): Promise<ActionResult> {
  try {
    const v = themeSchema.parse(input);
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("profiles")
      .update(v)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const store = await cookies();
    store.set(THEME_COOKIE, v.theme, THEME_COOKIE_OPTIONS);
    store.set(ACCENT_COOKIE, v.accent, THEME_COOKIE_OPTIONS);
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function acceptPrivacy(): Promise<ActionResult> {
  try {
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("consents")
      .insert({
        user_id: userId,
        kind: "privacy_policy",
        version: PRIVACY_VERSION,
      });
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function deleteAccount(
  confirmation: string,
): Promise<ActionResult> {
  if (confirmation !== "DELETE")
    return { ok: false, error: "Type DELETE to confirm." };
  const { supabase } = await session();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false, error: error.message };
  await supabase.auth.signOut();
  redirect("/login");
}
