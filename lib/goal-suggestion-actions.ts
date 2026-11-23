"use server";
// Accepting a suggested mapping saves which holdings cover a goal. Each call
// is the user's explicit Accept or Save; nothing else writes here.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "./data";
import { todayIST } from "./dates";
import { mergeMapping, type MapRow } from "./mapping-merge";

const row = z.object({
  investmentId: z.string().uuid(),
  percent: z.number().gt(0).max(100),
});

type Result = { ok: true } | { ok: false; error: string };
const FULL =
  "Couldn't save the new mapping. Your previous one is kept. Try again.";

/**
 * Replaces the mapping for some goals, trimming other goals' shares of a
 * holding when it would be more than fully used. Restores the old mapping if
 * saving fails.
 */
async function replaceMapping(
  goalIds: string[],
  next: MapRow[],
): Promise<Result> {
  const { supabase, user } = await requireUser();
  const { data: before, error: readError } = await supabase
    .from("goal_allocations")
    .select("goal_id, holding_id, percent");
  if (readError || !before)
    return { ok: false, error: "Couldn't save. Try again." };
  const saved = before.map((b) => ({
    goalId: b.goal_id,
    investmentId: b.holding_id,
    percent: Number(b.percent),
  }));
  const merged = mergeMapping(saved, goalIds, next);
  const toRows = (rows: MapRow[]) =>
    rows.map((r) => ({
      user_id: user.id,
      goal_id: r.goalId,
      holding_id: r.investmentId,
      percent: r.percent,
    }));
  const { error: delError } = await supabase
    .from("goal_allocations")
    .delete()
    .eq("user_id", user.id);
  if (delError) return { ok: false, error: "Couldn't save. Try again." };
  const { error } = merged.length
    ? await supabase.from("goal_allocations").insert(toRows(merged))
    : { error: null };
  if (error) {
    if (saved.length)
      await supabase.from("goal_allocations").insert(toRows(saved));
    return { ok: false, error: FULL };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Saves which holdings cover one goal, replacing what covered it before. */
export async function saveGoalMapping(input: {
  goalId: string;
  rows: { investmentId: string; percent: number }[];
}): Promise<Result> {
  const v = z
    .object({ goalId: z.string().uuid(), rows: z.array(row).max(50) })
    .safeParse(input);
  if (!v.success)
    return { ok: false, error: "Check the shares and try again." };
  return replaceMapping(
    [v.data.goalId],
    v.data.rows.map((r) => ({ ...r, goalId: v.data.goalId })),
  );
}

/** Accept all: replaces the mapping of every goal listed, in one go. */
export async function saveAllMappings(input: {
  rows: { goalId: string; investmentId: string; percent: number }[];
}): Promise<Result> {
  const v = z
    .object({
      rows: z.array(row.extend({ goalId: z.string().uuid() })).max(500),
    })
    .safeParse(input);
  if (!v.success)
    return { ok: false, error: "Check the shares and try again." };
  const goalIds = [...new Set(v.data.rows.map((r) => r.goalId))];
  if (!goalIds.length) return { ok: true };
  return replaceMapping(goalIds, v.data.rows);
}

/** "Not now": hides a suggestion for a week. */
export async function snoozeSuggestion(key: string): Promise<Result> {
  const parsed = z.string().min(1).max(100).safeParse(key);
  if (!parsed.success) return { ok: false, error: "Invalid suggestion." };
  const { supabase } = await requireUser();
  const until = new Date(`${todayIST()}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + 7);
  const { error } = await supabase.rpc("snooze_update", {
    update_key: parsed.data,
    until_day: until.toISOString().slice(0, 10),
  });
  if (error) return { ok: false, error: "Couldn't hide it. Try again." };
  revalidatePath("/goals");
  return { ok: true };
}
