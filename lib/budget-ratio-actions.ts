"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./data";
import { budgetSheetSchema } from "./budget-sheet";
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
  if (parsed.data.includedEmiIds.length) {
    const { data, error } = await supabase.from("loans").select("id").eq("user_id", user.id).in("id", parsed.data.includedEmiIds);
    if (error || data?.length !== parsed.data.includedEmiIds.length) return { ok: false as const, error: "A selected loan is no longer available. Review your EMI selection." };
  }
  const { error } = await supabase.from("budget_ratio_plans").upsert({ user_id: user.id, plan: parsed.data, updated_at: new Date().toISOString() });
  if (error) return { ok: false as const, error: "Could not save your budget. Your edits are still here. Try again." };
  revalidatePath("/goals/budget");
  return { ok: true as const };
}

/** The manual sheet stores one owner-scoped document, without changing financial records. */
export async function saveBudgetSheet(input: unknown) {
  const parsed = budgetSheetSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Check the budget amounts." };
  const { supabase, user } = await requireUser();
  const loanIds = parsed.data.rows.flatMap((r) => r.loanId ? [r.loanId] : []);
  if (loanIds.length) {
    const { data, error } = await supabase.from("loans").select("id").eq("user_id", user.id).in("id", loanIds);
    if (error || data?.length !== loanIds.length) return { ok: false as const, error: "A loan has changed. Reload your budget before saving." };
  }
  const { error } = await supabase.from("budget_ratio_plans").upsert({ user_id: user.id, plan: parsed.data, updated_at: new Date().toISOString() });
  if (error) return { ok: false as const, error: "Could not save. Your edits are still here. Try again." };
  revalidatePath("/goals/budget");
  return { ok: true as const };
}

/** Reset only the authenticated owner's budget after an explicit in-app confirmation. */
export async function resetBudgetSheet(confirmation: unknown) {
  if (confirmation !== "RESET_BUDGET") return { ok: false as const, error: "Confirm that you want to reset this budget." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("budget_ratio_plans").delete().eq("user_id", user.id);
  if (error) return { ok: false as const, error: "Could not reset your budget. Try again." };
  revalidatePath("/goals/budget");
  return { ok: true as const };
}
