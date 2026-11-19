import "server-only";
import { cache } from "react";
import { requireUser } from "./data";
import { readBudgetSheet, type SheetLoan } from "./budget-sheet";

export const loadBudgetSheet = cache(async (salary: number, loans: SheetLoan[]) => {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("budget_ratio_plans").select("plan").eq("user_id", user.id).maybeSingle();
  if (error) return { plan: null, error: "Your saved budget could not be loaded. Reload before making changes." };
  const plan = readBudgetSheet(data?.plan ?? null, salary, loans);
  return plan ? { plan, error: null } : { plan: null, error: "Your saved budget needs checking. Reload or contact support before making changes." };
});
