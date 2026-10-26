"use server";

import { redirect } from "next/navigation";
import { userMayPay } from "@/lib/ai/budget";
import { openRouterSettings } from "@/lib/ai/openrouter";
import { sharedRouter } from "@/lib/ai/router";
import {
  combine,
  EXTRACT_PROMPT,
  type Extracted,
  maskPersonal,
  needsTieBreak,
  parseExtraction,
  type Review,
} from "@/lib/card-extract";
import { AI_CONSENT_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

export type ExtractResult =
  | { ok: true; review: Review }
  | { ok: false; error: string; needsAi?: boolean };

/**
 * Reads a card's features from text (pasted, or from a PDF) with two AI
 * models, and a paid one to settle differences when allowed. Returns facts
 * to review; nothing is saved.
 */
export async function extractCardFeatures(input: {
  text: string;
}): Promise<ExtractResult> {
  const raw = typeof input?.text === "string" ? input.text.trim() : "";
  if (raw.length < 40)
    return { ok: false, error: "Add a bit more about the card first." };
  const text = maskPersonal(raw.slice(0, 40_000));

  const settings = openRouterSettings();
  if (!settings)
    return { ok: false, error: "Reading card features isn't set up yet." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const userId = auth.user.id;

  // AI must be on, and agreed to under the wording that covers card documents.
  const [profile, consent] = await Promise.all([
    supabase
      .from("profiles")
      .select("ai_enabled")
      .eq("user_id", userId)
      .single(),
    supabase
      .from("consents")
      .select("version, granted")
      .eq("kind", "ai_processing")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (
    !profile.data?.ai_enabled ||
    !consent.data?.granted ||
    consent.data.version !== AI_CONSENT_VERSION
  )
    return { ok: false, needsAi: true, error: "" };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const used = await supabase
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .eq("feature", "card_features")
    .gte("created_at", since);
  if ((used.count ?? 0) >= settings.dailyLimit)
    return {
      ok: false,
      error: "You've read a lot of card documents today. Try again tomorrow.",
    };

  const messages = [
    { role: "system" as const, content: EXTRACT_PROMPT },
    { role: "user" as const, content: `Document:\n"""\n${text}\n"""` },
  ];
  const router = sharedRouter(settings);
  const mayPay = await userMayPay(supabase, settings);
  const answers = await router.readings("card_features", messages, 2, {
    userMayPay: mayPay,
  });
  const readings = answers
    .map((a) => parseExtraction(a.text))
    .filter((r): r is Extracted => r !== null);
  let usedPaid = answers.some((a) => a.tier === "paid");
  if (readings.length === 2 && needsTieBreak(readings)) {
    const tie = await router.tieBreak("card_features", messages, {
      userMayPay: mayPay,
      notFrom: answers.map((a) => a.model),
    });
    const r = tie ? parseExtraction(tie.text) : null;
    if (r) {
      readings.push(r);
      usedPaid = true;
    }
  }

  await supabase.from("ai_requests").insert({
    user_id: userId,
    feature: "card_features",
    model:
      answers
        .map((a) => a.model)
        .join(", ")
        .slice(0, 200) || "none",
    tier: usedPaid ? "paid" : "free",
    ok: readings.length > 0,
  });

  if (!readings.length)
    return {
      ok: false,
      error: "Couldn't read the features this time. Try again in a minute.",
    };
  return { ok: true, review: combine(readings, text) };
}
