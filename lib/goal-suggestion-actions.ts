"use server";
// Accepting a suggested mapping saves which holdings cover a goal. Each call
// is the user's explicit Accept or Save; nothing else writes here.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "./data";
import { todayIST } from "./dates";

const row = z.object({
  investmentId: z.string().uuid(),
  percent: z.number().gt(0).max(100),
});
const pct = (n: number) => Math.floor(n * 100) / 100;

type Result = { ok: true } | { ok: false; error: string };
const FULL =
  "A holding would be more than fully used across goals. Lower a share and try again.";

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
  const { supabase, user } = await requireUser();
  const { data: before, error: readError } = await supabase
    .from("goal_allocations")
    .select("holding_id, percent")
    .eq("goal_id", v.data.goalId);
  if (readError) return { ok: false, error: "Couldn't save. Try again." };
  const { error: delError } = await supabase
    .from("goal_allocations")
    .delete()
    .eq("goal_id", v.data.goalId);
  if (delError) return { ok: false, error: "Couldn't save. Try again." };
  const rows = v.data.rows
    .map((r) => ({ ...r, percent: pct(r.percent) }))
    .filter((r) => r.percent > 0);
  if (rows.length) {
    const { error } = await supabase.from("goal_allocations").insert(
      rows.map((r) => ({
        user_id: user.id,
        goal_id: v.data.goalId,
        holding_id: r.investmentId,
        percent: r.percent,
      })),
    );
    if (error) {
      // Put the previous mapping back so nothing is lost.
      if (before?.length)
        await supabase.from("goal_allocations").insert(
          before.map((b) => ({
            user_id: user.id,
            goal_id: v.data.goalId,
            holding_id: b.holding_id,
            percent: b.percent,
          })),
        );
      return { ok: false, error: FULL };
    }
  }
  revalidatePath("/", "layout");
  return { ok: true };
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
  const { supabase, user } = await requireUser();
  const { data: before, error: readError } = await supabase
    .from("goal_allocations")
    .select("goal_id, holding_id, percent")
    .in("goal_id", goalIds);
  if (readError) return { ok: false, error: "Couldn't save. Try again." };
  const { error: delError } = await supabase
    .from("goal_allocations")
    .delete()
    .in("goal_id", goalIds);
  if (delError) return { ok: false, error: "Couldn't save. Try again." };
  const rows = v.data.rows
    .map((r) => ({ ...r, percent: pct(r.percent) }))
    .filter((r) => r.percent > 0);
  const { error } = await supabase.from("goal_allocations").insert(
    rows.map((r) => ({
      user_id: user.id,
      goal_id: r.goalId,
      holding_id: r.investmentId,
      percent: r.percent,
    })),
  );
  if (error) {
    if (before?.length)
      await supabase
        .from("goal_allocations")
        .insert(
          before.map((b) => ({
            user_id: user.id,
            goal_id: b.goal_id,
            holding_id: b.holding_id,
            percent: b.percent,
          })),
        );
    return { ok: false, error: FULL };
  }
  revalidatePath("/", "layout");
  return { ok: true };
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
