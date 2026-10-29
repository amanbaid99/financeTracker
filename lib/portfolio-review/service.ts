import "server-only";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { readGoals } from "@/lib/data";
import { AI_CONSENT_VERSION } from "@/lib/legal";
import { userMayPay } from "@/lib/ai/budget";
import { openRouterSettings } from "@/lib/ai/openrouter";
import { sharedRouter } from "@/lib/ai/router";
import { checkPortfolio, majorChanges, orderFindings, reviewFacts, REVIEW_INSTRUCTIONS, snapshotSchema } from "./checks";

type Client = SupabaseClient<Database>;
export type ReviewSource = "cas" | "holding" | "balance" | "manual";

export async function aiAllowed(supabase: Client, userId: string) {
  const [profile, consent] = await Promise.all([
    supabase.from("profiles").select("ai_enabled").eq("user_id", userId).maybeSingle(),
    supabase.from("consents").select("granted, version").eq("user_id", userId)
      .eq("kind", "ai_processing").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return !profile.error && !consent.error && Boolean(profile.data?.ai_enabled && consent.data?.granted && consent.data.version === AI_CONSENT_VERSION);
}

/** Save a job marker before responding; AI work never delays or rolls back a holdings save. */
export async function schedulePortfolioReview(supabase: Client, userId: string, source: ReviewSource) {
  try {
    const { data: previous, error } = await supabase.from("portfolio_reviews").select("*").eq("user_id", userId).maybeSingle();
    if (error || !previous?.enabled) return;
    const revision = randomUUID();
    const queued = await supabase.from("portfolio_reviews").update({ revision, source, state: "pending", checked_at: new Date().toISOString() })
      .eq("user_id", userId).eq("enabled", true);
    if (queued.error) return;
    after(async () => {
      try {
        const current = await supabase.from("portfolio_reviews").select("revision, enabled").eq("user_id", userId).single();
        if (!current.data?.enabled || current.data.revision !== revision) return;
        // Uncached read after the mutation, never the page's pre-save data.
        const data = await readGoals();
        const { findings, snapshot } = checkPortfolio(data);
        const parsed = snapshotSchema.safeParse(previous.baseline);
        const major = majorChanges(parsed.success ? parsed.data : null, snapshot);
        const save = async (patch: Database["public"]["Tables"]["portfolio_reviews"]["Update"]) => {
          await supabase.from("portfolio_reviews").update(patch).eq("user_id", userId).eq("revision", revision).eq("enabled", true);
          revalidatePath("/portfolio");
        };
        const base = { findings, major, ai: false };
        const settings = openRouterSettings();
        // Consent is checked again immediately before sending, including revocations during the job.
        if (!settings || !await aiAllowed(supabase, userId)) {
          await save({ state: "unavailable", result: base as unknown as Json });
          return;
        }
        if ((source === "balance" || source === "holding") && !major.length) {
          await save({ state: "basic", result: base as unknown as Json });
          return;
        }
        const since = new Date(Date.now() - 86_400_000).toISOString();
        const used = await supabase.from("ai_requests").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("feature", "portfolio_review_attempt").gte("created_at", since);
        if (used.error || (used.count ?? 0) >= settings.dailyLimit) {
          await save({ state: "limited", result: base as unknown as Json });
          return;
        }
        // Reserve an attempt first so failures also count toward the daily limit.
        const attempt = await supabase.from("ai_requests").insert({ user_id: userId, feature: "portfolio_review_attempt", model: "none", tier: "free", ok: false }).select("id").single();
        if (attempt.error) {
          await save({ state: "unavailable", result: base as unknown as Json });
          return;
        }
        const reply = await sharedRouter(settings).answer("portfolio_review", [
          { role: "system", content: REVIEW_INSTRUCTIONS },
          { role: "user", content: JSON.stringify(reviewFacts(data.investments, data.goals, findings, major)) },
        ], { userMayPay: await userMayPay(supabase, settings) });
        const ordered = reply ? orderFindings(reply.text, findings) : null;
        await supabase.from("ai_requests").insert({ user_id: userId, feature: "portfolio_review", model: reply?.model ?? "none", tier: reply?.tier ?? "free", ok: ordered !== null });
        if (!await aiAllowed(supabase, userId)) {
          await save({ state: "unavailable", result: base as unknown as Json });
          return;
        }
        await save(ordered ? {
          state: "ready", reviewed_at: new Date().toISOString(), baseline: snapshot as unknown as Json,
          result: { findings: ordered, major, ai: true } as unknown as Json,
        } : { state: "unavailable", result: base as unknown as Json });
      } catch {
        // Never turn a successful save into an error, or leave a failed review looking current.
        await supabase.from("portfolio_reviews").update({ state: "unavailable", result: null })
          .eq("user_id", userId).eq("revision", revision).eq("enabled", true);
        revalidatePath("/portfolio");
      }
    });
  } catch {
    // Missing migration or unavailable review storage must not prevent saving holdings.
  }
}
