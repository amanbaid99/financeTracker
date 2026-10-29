"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { openRouterSettings } from "@/lib/ai/openrouter";
import { aiAllowed, schedulePortfolioReview } from "./service";

export async function setPortfolioReviewsEnabled(enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  if (typeof enabled !== "boolean") return { ok: false, error: "Choose on or off." };
  const { supabase, user } = await requireUser();
  if (enabled && (!openRouterSettings() || !await aiAllowed(supabase, user.id)))
    return { ok: false, error: "Turn on AI in Ask first, then enable portfolio reviews here." };
  const { error } = await supabase.from("portfolio_reviews").upsert({ user_id: user.id, enabled, state: "idle", revision: randomUUID(), result: null, baseline: null, reviewed_at: null, checked_at: null });
  if (error) return { ok: false, error: "Portfolio reviews are not available yet. Your holdings are saved as usual." };
  if (enabled) await schedulePortfolioReview(supabase, user.id, "manual");
  revalidatePath("/portfolio");
  return { ok: true };
}

export async function runPortfolioReview(): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("portfolio_reviews").select("enabled, state, checked_at").eq("user_id", user.id).maybeSingle();
  if (!data?.enabled) return { ok: false, error: "Turn on automatic reviews first." };
  if (!await aiAllowed(supabase, user.id)) return { ok: false, error: "Turn on AI in Ask first." };
  if (data.state === "pending" && data.checked_at && Date.now() - new Date(data.checked_at).getTime() < 180_000)
    return { ok: false, error: "A review is already running." };
  await schedulePortfolioReview(supabase, user.id, "manual");
  revalidatePath("/portfolio");
  return { ok: true };
}
