"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { HOLDING_CATEGORIES } from "@/lib/engine/categories";
import { addMonths, todayIST } from "@/lib/engine/dates";
import { riskFromAnswers } from "@/lib/engine/risk";
import type { Section } from "@/lib/engine/types";
import { AI_CONSENT_VERSION, DISCLAIMER_VERSION, PRIVACY_VERSION } from "@/lib/legal";
import type { Database } from "@/lib/supabase/database.types";
import { mergeOverrides, type Obj } from "@/lib/overrides";
import { createClient } from "@/lib/supabase/server";
import { ACCENT_COOKIE, ACCENTS, THEME_COOKIE, THEME_COOKIE_OPTIONS, THEMES } from "@/lib/theme";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

type SyncTable = "expenses" | "insurance_policies" | "liabilities" | "holdings" | "credit_cards" | "planned_expenses";

const money = z.number().int().min(0).max(1e13);
const optMoney = money.nullable().optional();
const uuid = z.string().uuid();

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, userId: data.user.id };
}

function fail(e: unknown): ActionResult {
  if (e instanceof z.ZodError) {
    const first = e.issues[0];
    return { ok: false, error: `Check ${first.path.join(" ") || "your input"}: ${first.message}` };
  }
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

function done(id?: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, id };
}

async function markAnswered(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, section: Section) {
  const { data } = await supabase.from("profiles").select("answered_sections").eq("user_id", userId).single();
  const current = data?.answered_sections ?? [];
  if (current.includes(section)) return;
  const { error } = await supabase
    .from("profiles")
    .update({ answered_sections: [...current, section] })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Makes the user's rows in `table` match `rows`: rows with an id are updated,
 * rows without are inserted, and rows not listed are deleted.
 */
async function syncRows<T extends { id?: string | null }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  table: SyncTable,
  rows: T[],
  toDb: (row: T) => Record<string, unknown>,
): Promise<string[]> {
  // The rows differ per table, so this helper works with the untyped builder.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const from = () => (supabase as any).from(table);
  const keep = rows.map((r) => r.id).filter((id): id is string => Boolean(id));
  let del = from().delete().eq("user_id", userId);
  if (keep.length) del = del.not("id", "in", `(${keep.join(",")})`);
  const { error: delError } = await del;
  if (delError) throw new Error(delError.message);
  if (!rows.length) return [];
  const payload = rows.map((r) => ({ ...(r.id ? { id: r.id } : {}), ...toDb(r), user_id: userId }));
  const { data, error } = await from().upsert(payload, { defaultToNull: false }).select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { id: string }) => r.id);
}

// ---------------------------------------------------------------------------
// Profile sections
// ---------------------------------------------------------------------------

const basicsSchema = z.object({
  name: z.string().trim().min(1, "add your name").max(80),
  age: z.number().int().min(15).max(100),
  cityTier: z.enum(["metro", "tier2", "tier3"]).nullable(),
  theme: z.enum(THEMES),
  accent: z.enum(ACCENTS),
});

export async function saveBasics(input: z.input<typeof basicsSchema>): Promise<ActionResult> {
  try {
    const v = basicsSchema.parse(input);
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("profiles")
      .update({ name: v.name, age: v.age, city_tier: v.cityTier, theme: v.theme, accent: v.accent })
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

const themeSchema = z.object({ theme: z.enum(THEMES), accent: z.enum(ACCENTS) });

export async function saveTheme(input: z.input<typeof themeSchema>): Promise<ActionResult> {
  try {
    const v = themeSchema.parse(input);
    const { supabase, userId } = await session();
    const { error } = await supabase.from("profiles").update(v).eq("user_id", userId);
    if (error) throw new Error(error.message);
    const store = await cookies();
    store.set(THEME_COOKIE, v.theme, THEME_COOKIE_OPTIONS);
    store.set(ACCENT_COOKIE, v.accent, THEME_COOKIE_OPTIONS);
    return done();
  } catch (e) {
    return fail(e);
  }
}

const householdSchema = z.object({
  maritalStatus: z.enum(["single", "married", "other"]).nullable(),
  dependents: z.number().int().min(0).max(20).nullable(),
  soleEarner: z.boolean().nullable(),
});

export async function saveHousehold(input: z.input<typeof householdSchema>): Promise<ActionResult> {
  try {
    const v = householdSchema.parse(input);
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("profiles")
      .update({ marital_status: v.maritalStatus, dependents: v.dependents, sole_earner: v.soleEarner })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await markAnswered(supabase, userId, "household");
    return done();
  } catch (e) {
    return fail(e);
  }
}

const incomeSchema = z.object({
  id: uuid.nullable().optional(),
  label: z.string().trim().min(1, "name each income").max(60),
  type: z.enum(["stable_salary", "variable_salary", "freelance", "business", "rental", "bonus", "other"]),
  amountMonthly: money,
  fixedMonthly: optMoney,
  isGross: z.boolean().default(false),
  isPrimary: z.boolean().default(false),
  /** Up to 6 past months, most recent first. Nulls are skipped. */
  history: z.array(money.nullable()).max(6).default([]),
});

export async function saveIncomes(input: z.input<typeof incomeSchema>[]): Promise<ActionResult> {
  try {
    const rows = z.array(incomeSchema).min(1, "add at least one income").max(20).parse(input);
    const { supabase, userId } = await session();
    const keep = rows.map((r) => r.id).filter((id): id is string => Boolean(id));
    let del = supabase.from("income_streams").delete().eq("user_id", userId);
    if (keep.length) del = del.not("id", "in", `(${keep.join(",")})`);
    const { error: delStreams } = await del;
    if (delStreams) throw new Error(delStreams.message);
    // One row at a time so each stream's id is known for its history.
    const ids: string[] = [];
    for (const r of rows) {
      const row = {
        label: r.label,
        type: r.type,
        amount_monthly: r.amountMonthly,
        fixed_monthly: r.type === "variable_salary" ? (r.fixedMonthly ?? null) : null,
        is_gross: r.isGross,
        is_primary: r.isPrimary,
        active: true,
      };
      const res = r.id
        ? await supabase.from("income_streams").update(row).eq("id", r.id).eq("user_id", userId).select("id").single()
        : await supabase.from("income_streams").insert({ ...row, user_id: userId }).select("id").single();
      if (res.error) throw new Error(res.error.message);
      ids.push(res.data.id);
    }
    // Replace monthly history for each stream. Month 0 is last month.
    const thisMonth = `${todayIST().slice(0, 7)}-01`;
    for (let i = 0; i < rows.length; i++) {
      const streamId = ids[i];
      const { error: delError } = await supabase.from("income_entries").delete().eq("stream_id", streamId);
      if (delError) throw new Error(delError.message);
      const entries = rows[i].history
        .map((amount, k) => ({ amount, month: addMonths(thisMonth, -(k + 1)) }))
        .filter((e): e is { amount: number; month: string } => e.amount !== null)
        .map((e) => ({ ...e, stream_id: streamId, user_id: userId }));
      if (entries.length) {
        const { error } = await supabase.from("income_entries").insert(entries);
        if (error) throw new Error(error.message);
      }
    }
    await markAnswered(supabase, userId, "income");
    return done();
  } catch (e) {
    return fail(e);
  }
}

const expenseSchema = z.object({
  id: uuid.nullable().optional(),
  category: z.string().trim().min(1).max(60),
  amountMonthly: money,
  isEssential: z.boolean().default(true),
});

export async function saveExpenses(input: z.input<typeof expenseSchema>[]): Promise<ActionResult> {
  try {
    const rows = z.array(expenseSchema).max(40).parse(input).filter((r) => r.amountMonthly > 0);
    const { supabase, userId } = await session();
    await syncRows(supabase, userId, "expenses", rows, (r) => ({
      category: r.category,
      amount_monthly: r.amountMonthly,
      is_essential: r.isEssential,
    }));
    await markAnswered(supabase, userId, "expenses");
    return done();
  } catch (e) {
    return fail(e);
  }
}

const insuranceSchema = z.object({
  id: uuid.nullable().optional(),
  kind: z.enum(["health", "term", "other"]),
  source: z.enum(["personal", "employer", "family"]),
  coverAmount: money,
  premium: optMoney,
  premiumFrequency: z.enum(["monthly", "quarterly", "half_yearly", "yearly"]).default("yearly"),
  covers: z.enum(["self", "family", "others"]).default("self"),
  renewalMonth: z.number().int().min(1).max(12).nullable().optional(),
  renewalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  debitDay: z.number().int().min(1).max(31).nullable().optional(),
  inBudget: z.boolean().default(true),
});

export async function saveInsurance(input: z.input<typeof insuranceSchema>[]): Promise<ActionResult> {
  try {
    const rows = z.array(insuranceSchema).max(20).parse(input);
    const { supabase, userId } = await session();
    await syncRows(supabase, userId, "insurance_policies", rows, (r) => ({
      kind: r.kind,
      source: r.source,
      cover_amount: r.coverAmount,
      premium: r.premium ?? null,
      premium_frequency: r.premiumFrequency,
      covers: r.kind === "term" ? "self" : r.covers,
      // Monthly premiums use a debit day; others use a renewal date.
      debit_day: r.premiumFrequency === "monthly" ? (r.debitDay ?? null) : null,
      renewal_date: r.premiumFrequency === "monthly" ? null : (r.renewalDate ?? null),
      renewal_month: r.renewalDate ? Number(r.renewalDate.slice(5, 7)) : (r.renewalMonth ?? null),
      in_budget: r.inBudget,
    }));
    await markAnswered(supabase, userId, "insurance");
    return done();
  } catch (e) {
    return fail(e);
  }
}

const liabilitySchema = z.object({
  id: uuid.nullable().optional(),
  kind: z.enum(["credit_card", "personal_loan", "car", "home", "education", "other"]),
  label: z.string().trim().max(60).nullable().optional(),
  outstanding: money,
  interestRate: z.number().min(0).max(99).nullable().optional(),
  emi: optMoney,
});

export async function saveLiabilities(input: z.input<typeof liabilitySchema>[]): Promise<ActionResult> {
  try {
    const rows = z.array(liabilitySchema).max(30).parse(input);
    const { supabase, userId } = await session();
    await syncRows(supabase, userId, "liabilities", rows, (r) => ({
      kind: r.kind,
      label: r.label || null,
      outstanding: r.outstanding,
      interest_rate: r.interestRate ?? null,
      emi: r.emi ?? null,
    }));
    await markAnswered(supabase, userId, "liabilities");
    return done();
  } catch (e) {
    return fail(e);
  }
}

const categoryValues = HOLDING_CATEGORIES.map((c) => c.value) as [string, ...string[]];
const holdingSchema = z.object({
  id: uuid.nullable().optional(),
  kind: z.enum(["savings", "fd", "ppf", "epf", "nps", "mutual_fund", "stock", "gold", "other"]),
  name: z.string().trim().max(80).nullable().optional(),
  category: z.enum(categoryValues).nullable().optional(),
  currentValue: money,
  monthlySip: optMoney,
  sipStepUpPct: z.number().min(0).max(50).nullable().optional(),
  expectedReturnPct: z.number().min(0).max(30).nullable().optional(),
  /**
   * Optional goal for this holding, set from the holdings form. Only sent when
   * the user changed it. "none" removes links; a goal links 100% of the holding.
   */
  goalLink: z
    .discriminatedUnion("mode", [
      z.object({ mode: z.literal("none") }),
      z.object({ mode: z.literal("existing"), goalId: uuid }),
      z.object({
        mode: z.literal("new"),
        name: z.string().trim().min(1, "name the new goal").max(60),
        type: z.enum([
          "emergency_fund",
          "insurance_premium_fund",
          "wedding",
          "house_down_payment",
          "vehicle",
          "education",
          "travel",
          "retirement",
          "medical",
          "custom",
        ]),
        targetToday: money.min(1, "add the goal's target amount"),
        targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pick the goal's date").nullable(),
      }),
    ])
    .optional(),
});

/** Inserts or updates one holding and, if asked, links it to a goal (100%). */
async function upsertHolding(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  r: z.output<typeof holdingSchema>,
): Promise<string> {
  const row = {
    kind: r.kind,
    name: r.name || null,
    category: r.category ?? null,
    current_value: r.currentValue,
    monthly_sip: r.monthlySip ?? null,
    sip_step_up_pct: r.monthlySip ? (r.sipStepUpPct ?? null) : null,
    expected_return_pct: r.expectedReturnPct ?? null,
  };
  const res = r.id
    ? await supabase.from("holdings").update(row).eq("id", r.id).eq("user_id", userId).select("id").single()
    : await supabase.from("holdings").insert({ ...row, user_id: userId }).select("id").single();
  if (res.error) throw new Error(res.error.message);
  const holdingId = res.data.id;

  if (!r.goalLink) return holdingId;
  let goalId: string | null = null;
  if (r.goalLink.mode === "existing") goalId = r.goalLink.goalId;
  if (r.goalLink.mode === "new") {
    const g = await supabase
      .from("goals")
      .insert({
        user_id: userId,
        name: r.goalLink.name,
        type: r.goalLink.type,
        target_today: r.goalLink.targetToday,
        target_date: r.goalLink.targetDate,
        priority: 3,
      })
      .select("id")
      .single();
    if (g.error) throw new Error(g.error.message);
    goalId = g.data.id;
    await markAnswered(supabase, userId, "goals");
  }
  const { error: clearError } = await supabase
    .from("goal_allocations")
    .delete()
    .eq("user_id", userId)
    .eq("holding_id", holdingId);
  if (clearError) throw new Error(clearError.message);
  if (goalId) {
    const { error } = await supabase
      .from("goal_allocations")
      .insert({ user_id: userId, holding_id: holdingId, goal_id: goalId, percent: 100 });
    if (error) throw new Error(error.message);
  }
  return holdingId;
}

export async function saveHolding(input: z.input<typeof holdingSchema>): Promise<ActionResult> {
  try {
    const r = holdingSchema.parse(input);
    const { supabase, userId } = await session();
    const id = await upsertHolding(supabase, userId, r);
    await markAnswered(supabase, userId, "holdings");
    return done(id);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteHolding(id: string): Promise<ActionResult> {
  try {
    uuid.parse(id);
    const { supabase, userId } = await session();
    const { error } = await supabase.from("holdings").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function saveHoldings(input: z.input<typeof holdingSchema>[]): Promise<ActionResult> {
  try {
    const rows = z.array(holdingSchema).max(60).parse(input);
    const { supabase, userId } = await session();

    const keep = rows.map((r) => r.id).filter((id): id is string => Boolean(id));
    let del = supabase.from("holdings").delete().eq("user_id", userId);
    if (keep.length) del = del.not("id", "in", `(${keep.join(",")})`);
    const { error: delError } = await del;
    if (delError) throw new Error(delError.message);

    for (const r of rows) await upsertHolding(supabase, userId, r);
    await markAnswered(supabase, userId, "holdings");
    return done();
  } catch (e) {
    return fail(e);
  }
}

const allocationSchema = z.object({
  holdingId: uuid,
  allocations: z
    .array(z.object({ goalId: uuid, percent: z.number().gt(0).max(100) }))
    .max(20)
    .refine((a) => a.reduce((s, x) => s + x.percent, 0) <= 100, "a holding can't be more than 100% allocated")
    .refine((a) => new Set(a.map((x) => x.goalId)).size === a.length, "each goal can appear once"),
});

export async function saveAllocations(input: z.input<typeof allocationSchema>): Promise<ActionResult> {
  try {
    const v = allocationSchema.parse(input);
    const { supabase, userId } = await session();
    const { error: delError } = await supabase
      .from("goal_allocations")
      .delete()
      .eq("user_id", userId)
      .eq("holding_id", v.holdingId);
    if (delError) throw new Error(delError.message);
    if (v.allocations.length) {
      const { error } = await supabase.from("goal_allocations").insert(
        v.allocations.map((a) => ({
          user_id: userId,
          holding_id: v.holdingId,
          goal_id: a.goalId,
          percent: a.percent,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return done();
  } catch (e) {
    return fail(e);
  }
}

const goalSchema = z.object({
  id: uuid.nullable().optional(),
  name: z.string().trim().min(1, "name your goal").max(60),
  type: z.enum([
    "emergency_fund",
    "insurance_premium_fund",
    "wedding",
    "house_down_payment",
    "vehicle",
    "education",
    "travel",
    "retirement",
    "medical",
    "custom",
  ]),
  targetToday: money.min(1, "add a target amount"),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pick a date").nullable(),
  priority: z.number().int().min(1).max(5),
  inflationRate: z.number().min(0).max(30).nullable().optional(),
  savedAmount: money.default(0),
});

export async function saveGoal(input: z.input<typeof goalSchema>): Promise<ActionResult> {
  try {
    const v = goalSchema.parse(input);
    const { supabase, userId } = await session();
    const row = {
      name: v.name,
      type: v.type,
      target_today: v.targetToday,
      target_date: v.targetDate,
      priority: v.priority,
      inflation_rate: v.inflationRate ?? null,
      saved_amount: v.savedAmount,
    };
    if (v.id) {
      const { error } = await supabase.from("goals").update(row).eq("id", v.id).eq("user_id", userId);
      if (error) throw new Error(error.message);
      await markAnswered(supabase, userId, "goals");
      return done(v.id);
    }
    const { data, error } = await supabase
      .from("goals")
      .insert({ ...row, user_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await markAnswered(supabase, userId, "goals");
    return done(data.id);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  try {
    uuid.parse(id);
    const { supabase, userId } = await session();
    const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function saveRisk(answers: number[]): Promise<ActionResult> {
  try {
    const v = z.array(z.number().int().min(0).max(2)).length(3).parse(answers);
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("profiles")
      .update({ risk_profile: riskFromAnswers(v) })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await markAnswered(supabase, userId, "risk");
    return done();
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Monthly status: cards, planned expenses, bills, bank balances
// ---------------------------------------------------------------------------

const cardSchema = z.object({
  id: uuid.nullable().optional(),
  label: z.string().trim().min(1, "name each card").max(40),
  outstanding: money,
  statementDay: z.number().int().min(1).max(31).nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
});

export async function saveCards(input: z.input<typeof cardSchema>[]): Promise<ActionResult> {
  try {
    const rows = z.array(cardSchema).max(20).parse(input);
    const { supabase, userId } = await session();
    await syncRows(supabase, userId, "credit_cards", rows, (r) => ({
      label: r.label,
      outstanding: r.outstanding,
      statement_day: r.statementDay ?? null,
      due_day: r.dueDay ?? null,
    }));
    return done();
  } catch (e) {
    return fail(e);
  }
}

const plannedSchema = z.object({
  id: uuid.nullable().optional(),
  name: z.string().trim().min(1, "name each planned expense").max(60),
  amount: money.min(1, "add an amount"),
  everyMonths: z.number().int().min(1).max(120),
  nextDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  inBudget: z.boolean().default(true),
});

export async function savePlanned(input: z.input<typeof plannedSchema>[]): Promise<ActionResult> {
  try {
    const rows = z.array(plannedSchema).max(40).parse(input);
    const { supabase, userId } = await session();
    await syncRows(supabase, userId, "planned_expenses", rows, (r) => ({
      name: r.name,
      amount: r.amount,
      every_months: r.everyMonths,
      next_due: r.nextDue ?? null,
      in_budget: r.inBudget,
    }));
    return done();
  } catch (e) {
    return fail(e);
  }
}

const billSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/),
  key: z.string().min(1).max(80),
  paid: z.boolean(),
  /** Planned expense to roll forward to its next occurrence once paid. */
  plannedId: uuid.optional(),
});

export async function setBillPaid(input: z.input<typeof billSchema>): Promise<ActionResult> {
  try {
    const v = billSchema.parse(input);
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("bill_status")
      .upsert(
        { user_id: userId, month: v.month, bill_key: v.key, paid: v.paid, updated_at: new Date().toISOString() },
        { onConflict: "user_id,month,bill_key" },
      );
    if (error) throw new Error(error.message);
    if (v.plannedId) {
      const { data: p } = await supabase
        .from("planned_expenses")
        .select("next_due, every_months")
        .eq("id", v.plannedId)
        .eq("user_id", userId)
        .maybeSingle();
      if (p?.next_due) {
        const nextDue = addMonths(p.next_due, v.paid ? p.every_months : -p.every_months);
        await supabase.from("planned_expenses").update({ next_due: nextDue }).eq("id", v.plannedId).eq("user_id", userId);
      }
    }
    return done();
  } catch (e) {
    return fail(e);
  }
}

const monthBillSchema = z.object({
  /** Existing row this month to update; omit to create one. */
  id: uuid.nullable().optional(),
  /** Repeating series to add this month's amount to. */
  seriesId: uuid.nullable().optional(),
  cardId: uuid.nullable().optional(),
  label: z.string().trim().min(1, "name the bill").max(60),
  /** Null = not generated yet. */
  amount: money.nullable(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  recurring: z.boolean().default(false),
});

export async function saveMonthBill(input: z.input<typeof monthBillSchema>): Promise<ActionResult> {
  try {
    const v = monthBillSchema.parse(input);
    const { supabase, userId } = await session();
    const row = {
      label: v.label,
      amount: v.amount,
      due_day: v.dueDay ?? null,
      recurring: v.cardId ? false : v.recurring,
      card_id: v.cardId ?? null,
    };
    if (v.id) {
      const { error } = await supabase.from("month_bills").update(row).eq("id", v.id).eq("user_id", userId);
      if (error) throw new Error(error.message);
      return done(v.id);
    }
    const month = `${todayIST().slice(0, 7)}-01`;
    // Card bills use the card id as their series, so there's one per card per month.
    const seriesId = v.cardId ?? v.seriesId ?? undefined;
    const { data, error } = await supabase
      .from("month_bills")
      .insert({ ...row, user_id: userId, month, ...(seriesId ? { series_id: seriesId } : {}) })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return done(data.id);
  } catch (e) {
    return fail(e);
  }
}

/** Removes this month's entry; with stopRepeating, the whole repeating series. */
export async function deleteMonthBill(input: { seriesId: string; stopRepeating: boolean }): Promise<ActionResult> {
  try {
    const v = z.object({ seriesId: uuid, stopRepeating: z.boolean() }).parse(input);
    const { supabase, userId } = await session();
    let q = supabase.from("month_bills").delete().eq("user_id", userId).eq("series_id", v.seriesId);
    if (!v.stopRepeating) q = q.eq("month", `${todayIST().slice(0, 7)}-01`);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

const quickUpdateSchema = z.object({
  holdings: z.array(z.object({ id: uuid, value: money })).max(100).default([]),
  cards: z.array(z.object({ id: uuid, outstanding: money })).max(40).default([]),
  liabilities: z.array(z.object({ id: uuid, outstanding: money })).max(40).default([]),
  goals: z.array(z.object({ id: uuid, saved: money })).max(40).default([]),
});

/** Saves many balances at once from the Quick update screen. Only changed rows are sent. */
export async function quickUpdate(input: z.input<typeof quickUpdateSchema>): Promise<ActionResult> {
  try {
    const v = quickUpdateSchema.parse(input);
    const { supabase, userId } = await session();
    const results = await Promise.all([
      ...v.holdings.map((h) =>
        supabase.from("holdings").update({ current_value: h.value }).eq("id", h.id).eq("user_id", userId),
      ),
      ...v.cards.map((c) =>
        supabase.from("credit_cards").update({ outstanding: c.outstanding }).eq("id", c.id).eq("user_id", userId),
      ),
      ...v.liabilities.map((l) =>
        supabase.from("liabilities").update({ outstanding: l.outstanding }).eq("id", l.id).eq("user_id", userId),
      ),
      ...v.goals.map((g) =>
        supabase.from("goals").update({ saved_amount: g.saved }).eq("id", g.id).eq("user_id", userId),
      ),
    ]);
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function updateBankBalance(input: { holdingId: string; value: number }): Promise<ActionResult> {
  try {
    const v = z.object({ holdingId: uuid, value: money }).parse(input);
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("holdings")
      .update({ current_value: v.value })
      .eq("id", v.holdingId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function addBankAccount(input: { label: string; value: number }): Promise<ActionResult> {
  try {
    const v = z.object({ label: z.string().trim().min(1, "name the account").max(80), value: money }).parse(input);
    const { supabase, userId } = await session();
    const { error } = await supabase.from("holdings").insert({
      user_id: userId,
      kind: "savings",
      name: v.label,
      category: "savings_account",
      current_value: v.value,
    });
    if (error) throw new Error(error.message);
    await markAnswered(supabase, userId, "holdings");
    return done();
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Consent, onboarding and AI
// ---------------------------------------------------------------------------

export async function completeOnboarding(input: { disclaimer: boolean; ai: boolean }): Promise<ActionResult> {
  try {
    if (!input.disclaimer) return { ok: false, error: "Please tick “I understand” to continue." };
    const { supabase, userId } = await session();
    const now = new Date().toISOString();
    const consentRows: Database["public"]["Tables"]["consents"]["Insert"][] = [
      { user_id: userId, kind: "disclaimer", version: DISCLAIMER_VERSION },
    ];
    if (input.ai) consentRows.push({ user_id: userId, kind: "ai_processing", version: AI_CONSENT_VERSION });
    const { error: cError } = await supabase.from("consents").insert(consentRows);
    if (cError) throw new Error(cError.message);
    const { error } = await supabase
      .from("profiles")
      .update({ disclaimer_accepted_at: now, onboarding_completed_at: now, ai_enabled: input.ai })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
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
      .insert({ user_id: userId, kind: "privacy_policy", version: PRIVACY_VERSION });
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function setAiEnabled(enabled: boolean): Promise<ActionResult> {
  try {
    const { supabase, userId } = await session();
    const { error: cError } = await supabase
      .from("consents")
      .insert({ user_id: userId, kind: "ai_processing", version: AI_CONSENT_VERSION, granted: enabled });
    if (cError) throw new Error(cError.message);
    const { error } = await supabase.from("profiles").update({ ai_enabled: enabled }).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const pct = (max: number) => z.number().min(0).max(max).nullable().optional();
const split3 = z
  .object({ ladder: z.number().min(0).max(1), goals: z.number().min(0).max(1), wants: z.number().min(0).max(1) })
  .refine((x) => Math.abs(x.ladder + x.goals + x.wants - 1) < 0.001, "the three parts must add up to 100%")
  .nullable()
  .optional();

// Every field is optional; null resets it to the default.
const overridesSchema = z
  .object({
    budget: z
      .object({
        savingsMinPct: pct(0.9),
        essentialsPlusSavingsCapPct: pct(1),
        variableSurplus: split3,
        bonusSurplus: split3,
        secondarySurplus: z
          .object({ ladderGoals: z.number().min(0).max(1), wants: z.number().min(0).max(1) })
          .refine((x) => Math.abs(x.ladderGoals + x.wants - 1) < 0.001, "the two parts must add up to 100%")
          .nullable()
          .optional(),
        freelance: z.object({ taxReservePct: pct(0.6) }).optional(),
      })
      .optional(),
    ladder: z
      .object({
        healthCoverMetro: money.nullable().optional(),
        healthCoverOther: money.nullable().optional(),
        termIncomeMultiple: z.number().min(5).max(30).nullable().optional(),
        termCoverTarget: money.nullable().optional(),
        highInterestThresholdPct: z.number().min(0).max(40).nullable().optional(),
        retirementBaselinePct: pct(0.5),
        debtMethod: z.enum(["snowball", "avalanche"]).nullable().optional(),
        debtAfterGoals: z.boolean().nullable().optional(),
      })
      .optional(),
    goals: z.object({ retirementAge: z.number().int().min(40).max(75).nullable().optional() }).optional(),
  })
  .strict();

export async function saveOverrides(input: z.input<typeof overridesSchema>): Promise<ActionResult> {
  try {
    const v = overridesSchema.parse(input);
    const { supabase, userId } = await session();
    const { data } = await supabase.from("settings").select("config_overrides").eq("user_id", userId).single();
    const current = (data?.config_overrides ?? {}) as Obj;
    const next = mergeOverrides(current, v as Obj);
    const { error } = await supabase
      .from("settings")
      .update({ config_overrides: next as Database["public"]["Tables"]["settings"]["Update"]["config_overrides"] })
      .eq("user_id", userId);
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

export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  if (confirmation !== "DELETE") return { ok: false, error: "Type DELETE to confirm." };
  const { supabase } = await session();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false, error: error.message };
  await supabase.auth.signOut();
  redirect("/login");
}
