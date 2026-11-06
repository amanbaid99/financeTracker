"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { userMayPay } from "@/lib/ai/budget";
import { openRouterSettings } from "@/lib/ai/openrouter";
import { sharedRouter } from "@/lib/ai/router";
import { maskPersonal } from "@/lib/card-extract";
import { loadBudget } from "@/lib/data";
import {
  ESTIMATE_PROMPT,
  parseEstimate,
  type CostEstimate,
} from "@/lib/goal-calc";
import { createClient } from "@/lib/supabase/server";

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, userId: data.user.id };
}

export interface CalcContext {
  age: number | null;
  /** Monthly costs from the budget (without EMIs). */
  costs: number;
  /** Monthly EMIs from Credit. */
  emis: number;
  dependents: number;
  soleEarner: boolean;
  /** Ask (AI) is on, so cost estimates can be offered. */
  aiOn: boolean;
}

/** What the calculator can fill in for you. Nothing here is saved. */
export async function calcContext(): Promise<CalcContext> {
  const { supabase, userId } = await session();
  const [{ data: p }, b] = await Promise.all([
    supabase
      .from("profiles")
      .select("age, dob, dependents, sole_earner, ai_enabled")
      .eq("user_id", userId)
      .maybeSingle(),
    loadBudget(),
  ]);
  let age = p?.age ?? null;
  if (p?.dob) {
    const d = new Date(p.dob);
    const now = new Date();
    age =
      now.getFullYear() -
      d.getFullYear() -
      (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
  }
  return {
    age,
    costs: b.budget.costs,
    emis: b.budget.emis,
    dependents: p?.dependents ?? 0,
    soleEarner: !!p?.sole_earner,
    aiOn: !!p?.ai_enabled && openRouterSettings() !== null,
  };
}

const estimateSchema = z.object({
  goalType: z.string().max(40),
  description: z.string().trim().min(3, "say a little more").max(300),
});

/**
 * AI's rough cost for something, in today's rupees, as a range with its
 * assumptions. Only the description is sent, with personal details masked.
 */
export async function estimateCost(
  input: z.input<typeof estimateSchema>,
): Promise<
  { ok: true; estimate: CostEstimate } | { ok: false; error: string }
> {
  const v = estimateSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0].message };
  const settings = openRouterSettings();
  if (!settings) return { ok: false, error: "AI isn't set up yet." };
  const { supabase, userId } = await session();
  const { data: p } = await supabase
    .from("profiles")
    .select("ai_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (!p?.ai_enabled)
    return { ok: false, error: "Turn on Ask in Settings to use AI estimates." };
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const used = await supabase
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .eq("feature", "estimate")
    .gte("created_at", since);
  if ((used.count ?? 0) >= settings.dailyLimit)
    return {
      ok: false,
      error: "That's enough estimates for today. Try again tomorrow.",
    };

  const reply = await sharedRouter(settings).answer(
    "estimate",
    [
      { role: "system", content: ESTIMATE_PROMPT },
      {
        role: "user",
        content: `Goal type: ${v.data.goalType.replace(/_/g, " ")}.\nWhat it's for: ${maskPersonal(v.data.description)}`,
      },
    ],
    { userMayPay: await userMayPay(supabase, settings) },
  );
  await supabase.from("ai_requests").insert({
    user_id: userId,
    feature: "estimate",
    model: reply?.model ?? "none",
    tier: reply?.tier ?? "free",
    ok: Boolean(reply),
  });
  const estimate = reply ? parseEstimate(reply.text) : null;
  if (!estimate)
    return {
      ok: false,
      error:
        "Couldn't estimate that. Try describing it a bit more, or type a number.",
    };
  return { ok: true, estimate };
}
