"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Saves for "Between jobs" and "Covered till salary". Each runs only when
// the person presses a button; nothing here is automatic.

type Result = { ok: true; id?: string } | { ok: false; error: string };

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

function done(id?: string): Result {
  revalidatePath("/", "layout");
  return { ok: true, id };
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pick a date");

/** Between jobs: the earliest and latest salary date. Null turns it off. */
export async function saveSalaryDates(
  input: { best: string; worst: string } | null,
): Promise<Result> {
  try {
    const v = input
      ? z
          .object({ best: isoDate, worst: isoDate })
          .refine((x) => x.best <= x.worst, {
            message: "the latest date can't be before the earliest",
            path: ["latest date"],
          })
          .parse(input)
      : null;
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("profiles")
      .update({ salary_best: v?.best ?? null, salary_worst: v?.worst ?? null })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

const itemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  kind: z.enum(["owed_to_me", "to_pay"]),
  label: z.string().trim().min(1, "add a name").max(60),
  amount: z.number().int().min(1, "add an amount").max(1e8),
  due: isoDate.nullable(),
});

export async function saveRunwayItem(
  input: z.input<typeof itemSchema>,
): Promise<Result> {
  try {
    const v = itemSchema.parse(input);
    const { supabase, userId } = await session();
    const row = { kind: v.kind, label: v.label, amount: v.amount, due: v.due };
    const res = v.id
      ? await supabase
          .from("runway_items")
          .update(row)
          .eq("id", v.id)
          .eq("user_id", userId)
          .select("id")
          .single()
      : await supabase
          .from("runway_items")
          .insert({ ...row, user_id: userId })
          .select("id")
          .single();
    if (res.error) throw new Error(res.error.message);
    return done(res.data.id);
  } catch (e) {
    return fail(e);
  }
}

/** Paid, or received: it leaves the list (and Undo brings it back). */
export async function setRunwayItemDone(
  id: string,
  isDone: boolean,
): Promise<Result> {
  try {
    z.string().uuid().parse(id);
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("runway_items")
      .update({ done: isDone })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRunwayItem(id: string): Promise<Result> {
  try {
    z.string().uuid().parse(id);
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("runway_items")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

/** Count a line or not; null goes back to the app's guess. */
export async function setRunwayChoice(
  key: string,
  count: boolean | null,
): Promise<Result> {
  try {
    z.string().min(1).max(200).parse(key);
    const { supabase, userId } = await session();
    const { data, error } = await supabase
      .from("profiles")
      .select("runway_choices")
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    const choices = {
      ...((data.runway_choices as Record<string, boolean>) ?? {}),
    };
    if (count === null) delete choices[key];
    else choices[key] = count;
    const up = await supabase
      .from("profiles")
      .update({ runway_choices: choices })
      .eq("user_id", userId);
    if (up.error) throw new Error(up.error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}
