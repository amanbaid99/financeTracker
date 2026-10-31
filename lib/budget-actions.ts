"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loadBudget } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, userId: data.user.id };
}

function fail(e: unknown): Result {
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

function done(): Result {
  revalidatePath("/", "layout");
  return { ok: true };
}

const money = z.number().int().min(0).max(1e10);
const uuid = z.string().uuid();
const types = [
  "stable_salary",
  "variable_salary",
  "freelance",
  "business",
  "rental",
  "other",
] as const;

const incomeSchema = z.object({
  id: uuid.optional(),
  label: z.string().trim().min(1, "add a name").max(60),
  type: z.enum(types),
  amount: money,
});

/** Adds or edits one source of take-home pay. */
export async function saveIncome(
  input: z.input<typeof incomeSchema>,
): Promise<Result> {
  try {
    const v = incomeSchema.parse(input);
    const { supabase, userId } = await session();
    const row = {
      label: v.label,
      type: v.type,
      amount_monthly: v.amount,
      is_gross: false,
      active: true,
    };
    const { error } = v.id
      ? await supabase
          .from("income_streams")
          .update(row)
          .eq("id", v.id)
          .eq("user_id", userId)
      : await supabase
          .from("income_streams")
          .insert({ ...row, user_id: userId });
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

const costSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "add a name").max(60),
  amount: money,
});

/** Adds or edits one monthly cost. */
export async function saveCost(
  input: z.input<typeof costSchema>,
): Promise<Result> {
  try {
    const v = costSchema.parse(input);
    const { supabase, userId } = await session();
    const row = {
      category: v.name,
      amount_monthly: v.amount,
      is_essential: true,
    };
    const { error } = v.id
      ? await supabase
          .from("expenses")
          .update(row)
          .eq("id", v.id)
          .eq("user_id", userId)
      : await supabase.from("expenses").insert({ ...row, user_id: userId });
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

/** Removes an income or a cost. */
export async function deleteBudgetRow(input: {
  kind: "income" | "cost";
  id: string;
}): Promise<Result> {
  try {
    const id = uuid.parse(input.id);
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from(input.kind === "income" ? "income_streams" : "expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

/** Sets the money plan's monthly budget to what the budget leaves free. */
export async function applyBudgetToPlan(): Promise<Result> {
  try {
    const { supabase, userId } = await session();
    const { budget: b, plan } = await loadBudget();
    if (b.income <= 0)
      return { ok: false, error: "Add your take-home pay first." };
    const { error } = await supabase
      .from("profiles")
      .update({ plan_monthly: b.planMonthly, plan_lump_sum: plan?.lump ?? 0 })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}
