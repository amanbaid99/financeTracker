"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./data";
import { ratioPlanSchema } from "./budget-ratios";

export async function saveRatioPlan(input: unknown) {
  const parsed = ratioPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Check your budget ratios." };
  const { supabase, user } = await requireUser();
  const goalIds = parsed.data.buckets.flatMap((b) => b.children.flatMap((c) => c.goalId ? [c.goalId] : []));
  if (goalIds.length) {
    const { data, error } = await supabase.from("goals").select("id").eq("user_id", user.id).in("id", goalIds);
    if (error || data?.length !== goalIds.length) return { ok: false as const, error: "A linked goal is no longer available. Choose it again or remove the link." };
  }
  const { error } = await supabase.from("budget_ratio_plans").upsert({ user_id: user.id, plan: parsed.data, updated_at: new Date().toISOString() });
  if (error) return { ok: false as const, error: "Could not save your budget. Your edits are still here. Try again." };
  revalidatePath("/goals/budget");
  return { ok: true as const };
}
