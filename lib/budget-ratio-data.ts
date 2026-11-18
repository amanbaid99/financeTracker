import "server-only";
import { cache } from "react";
import { requireUser } from "./data";
import { ratioPlanSchema } from "./budget-ratios";

export const loadRatioPlan = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("budget_ratio_plans").select("plan").eq("user_id", user.id).maybeSingle();
  if (error) return { plan: null, error: "Your saved budget could not be loaded. Reload before making changes." };
  if (!data) return { plan: null, error: null };
  const parsed = ratioPlanSchema.safeParse(data.plan);
  return parsed.success ? { plan: parsed.data, error: null } : { plan: null, error: "Your saved budget needs checking. Reload or contact support before making changes." };
});
