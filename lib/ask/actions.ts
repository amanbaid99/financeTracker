"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { userMayPay } from "@/lib/ai/budget";
import { openRouterSettings } from "@/lib/ai/openrouter";
import { sharedRouter } from "@/lib/ai/router";
import { loadGoals } from "@/lib/data";
import { AI_CONSENT_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";
import { ASK_INSTRUCTIONS, buildAskContext, restoreNames } from "./context";

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, userId: data.user.id };
}

/** Turns Ask on or off, recording the choice. */
export async function setAskEnabled(
  on: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, userId } = await session();
  const consent = await supabase.from("consents").insert({
    user_id: userId,
    kind: "ai_processing",
    version: AI_CONSENT_VERSION,
    granted: on,
  });
  if (consent.error) return { ok: false, error: consent.error.message };
  const res = await supabase
    .from("profiles")
    .update({ ai_enabled: on })
    .eq("user_id", userId);
  if (res.error) return { ok: false, error: res.error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

const historySchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      // Assistant turns are sent back in their coded form, never with names.
      content: z.string().trim().min(1).max(4000),
    }),
  )
  .min(1)
  .max(20);

export type AskTurn = z.infer<typeof historySchema>[number];

export type AskResult =
  | { ok: true; coded: string; shown: string }
  | { ok: false; error: string };

/** Answers the latest question in `history` about the user's own money. */
export async function askQuestion(history: AskTurn[]): Promise<AskResult> {
  const parsed = historySchema.safeParse(history);
  if (!parsed.success || parsed.data.at(-1)?.role !== "user") {
    return { ok: false, error: "Type a question first." };
  }
  const settings = openRouterSettings();
  if (!settings) return { ok: false, error: "Ask isn't set up yet." };
  const { supabase, userId } = await session();

  const profile = await supabase
    .from("profiles")
    .select("ai_enabled")
    .eq("user_id", userId)
    .single();
  if (!profile.data?.ai_enabled)
    return { ok: false, error: "Turn on Ask first." };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const used = await supabase
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .eq("feature", "ask")
    .gte("created_at", since);
  if ((used.count ?? 0) >= settings.dailyLimit) {
    return {
      ok: false,
      error: `You've asked ${settings.dailyLimit} questions in the last day. Try again later.`,
    };
  }

  const { goals, investments, links, plan, today } = await loadGoals();
  const { facts, names } = buildAskContext({
    goals,
    investments,
    links,
    plan,
    todayISO: today,
  });
  const reply = await sharedRouter(settings).answer(
    "ask",
    [
      { role: "system", content: `${ASK_INSTRUCTIONS}\n\nFacts:\n${facts}` },
      ...parsed.data
        .slice(-10)
        .map((t) => ({ role: t.role, content: t.content })),
    ],
    { userMayPay: await userMayPay(supabase, settings) },
  );

  await supabase.from("ai_requests").insert({
    user_id: userId,
    feature: "ask",
    model: reply?.model ?? "none",
    tier: reply?.tier ?? "free",
    ok: Boolean(reply),
  });
  if (!reply)
    return { ok: false, error: "No answer came back. Try again in a minute." };
  return {
    ok: true,
    coded: reply.text,
    shown: restoreNames(reply.text, names),
  };
}
