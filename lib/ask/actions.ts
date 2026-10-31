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
import { formatINR } from "@/lib/format";
import {
  amountQuestion,
  frequencyChoices,
  splitFacts,
  unsupportedFigures,
} from "./amount";
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
  | {
      ok: true;
      coded: string;
      shown: string;
      /** Quick replies to tap, e.g. "₹10,000 once". */
      choices?: string[];
      /** The app worked out a split: offer to add it to the money plan. */
      plan?: { amount: number; frequency: "once" | "monthly" };
      /** Figures in the answer that couldn't be checked against your data. */
      unchecked?: string[];
    }
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

  // "Where should ₹10,000 go?": the app's planner answers; the AI explains.
  const question = amountQuestion(parsed.data.at(-1)!.content);
  if (question?.frequency === "unknown") {
    const text = `Is ${formatINR(question.amount)} a one-time amount, or every month? The answer is different for each.`;
    return {
      ok: true,
      coded: text,
      shown: text,
      choices: frequencyChoices(question.amount),
    };
  }

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
  const ctx = buildAskContext({
    goals,
    investments,
    links,
    plan,
    todayISO: today,
  });
  const { names } = ctx;
  let facts = ctx.facts;
  const known: number[] = [];
  let nothingToAdd = false;
  // Unclear ones were asked about above, so this one is once or monthly.
  const planned = question
    ? {
        amount: question.amount,
        frequency: question.frequency as "once" | "monthly",
      }
    : undefined;
  if (planned) {
    const split = splitFacts({
      q: planned,
      goals,
      investments,
      links,
      todayISO: today,
      codeOf: ctx.codeOf,
    });
    facts += `\n\n${split.facts}`;
    known.push(...split.numbers);
    nothingToAdd = split.empty;
  }
  const router = sharedRouter(settings);
  const mayPay = await userMayPay(supabase, settings);
  const messages = [
    {
      role: "system" as const,
      content: `${ASK_INSTRUCTIONS}\n\nFacts:\n${facts}`,
    },
    ...parsed.data
      .slice(-10)
      .map((t) => ({ role: t.role, content: t.content })),
  ];
  let reply = await router.answer("ask", messages, { userMayPay: mayPay });
  // Every figure in the answer must come from the facts. One retry with
  // the ones that didn't; anything still unchecked is flagged to the person.
  let unchecked = reply ? unsupportedFigures(reply.text, facts, known) : [];
  if (reply && unchecked.length) {
    const again = await router.answer(
      "ask",
      [
        ...messages,
        { role: "assistant", content: reply.text },
        {
          role: "user",
          content: `These figures aren't in the facts: ${unchecked.join(", ")}. Rewrite the answer using only figures that appear in the facts, without doing any sums.`,
        },
      ],
      { userMayPay: mayPay },
    );
    if (again) {
      const left = unsupportedFigures(again.text, facts, known);
      if (left.length <= unchecked.length) {
        reply = again;
        unchecked = left;
      }
    }
  }

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
    plan: planned && !nothingToAdd ? planned : undefined,
    unchecked: unchecked.length ? unchecked : undefined,
  };
}

const addSchema = z.object({
  amount: z.number().int().min(100).max(1e10),
  frequency: z.enum(["once", "monthly"]),
});

/**
 * "Add to This month" under an answer: adds the amount to the money plan
 * (savings now, or the monthly budget), so This month shows the steps.
 */
export async function addToPlan(
  input: z.input<typeof addSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const v = addSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "That amount didn't look right." };
  const { supabase, userId } = await session();
  const { investments, plan } = await loadGoals();
  const sipsNow = investments.reduce((s, i) => s + i.monthlySip, 0);
  const lump =
    (plan?.lump ?? 0) + (v.data.frequency === "once" ? v.data.amount : 0);
  const monthly =
    (plan?.monthly ?? sipsNow) +
    (v.data.frequency === "monthly" ? v.data.amount : 0);
  const { error } = await supabase
    .from("profiles")
    .update({ plan_lump_sum: lump, plan_monthly: monthly })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
