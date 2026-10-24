"use server";

import { loadAnalysis, requireUser } from "@/lib/data";
import { aiConfig } from "./config";
import { assertAnonymous, buildFacts, genericVocabulary, type AiFeature } from "./facts";
import { cleanOutput, findNamedProducts } from "./guard";
import { chat, type ChatMessage } from "./openrouter";

export type ExplainResult =
  | { ok: true; text: string; tier: "free" | "paid" }
  | { ok: false; error: string };

const SYSTEM = `You explain a personal finance plan in plain, friendly English for someone in India.
Rules you must follow:
- Use ONLY the numbers in the JSON you are given. Never calculate, estimate or invent new numbers.
- Never name, rank or recommend any fund, fund house, AMC, scheme, stock, bank or insurer. Talk only about categories (for example "liquid fund" or "equity index fund").
- Never tell the user to switch out of something they hold.
- Explain why the step or goal matters and what the numbers mean. Be encouraging, not preachy.
- No jargon without a short explanation. No em dashes. No headings. Short paragraphs or a short list.
- Do not add a disclaimer; the app shows one.`;

const LIMITS: Record<AiFeature, { words: number; tokens: number; complex: boolean }> = {
  next_focus: { words: 110, tokens: 300, complex: false },
  goal: { words: 130, tokens: 350, complex: false },
  plan_review: { words: 250, tokens: 700, complex: true },
};

const PROMPTS: Record<AiFeature, string> = {
  next_focus: "Explain why this is my next focus and how the suggested monthly amount gets me there.",
  goal: "Explain this goal's plan: why the future amount is higher than today's, what the monthly amount means, and why these categories suit the time left.",
  plan_review:
    "Give me a short review of my whole plan: what is going well, the order to tackle what's left, and one or two practical next actions. Point out any trade-off between goals.",
};

function istDayStartUTC(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const startIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  return new Date(startIst - 5.5 * 3600_000).toISOString();
}

export async function explain(feature: AiFeature, goalId?: string): Promise<ExplainResult> {
  if (!(feature in LIMITS)) return { ok: false, error: "Unknown request" };
  const cfg = aiConfig();
  if (!cfg) return { ok: false, error: "AI explanations aren't set up on this server yet." };

  const { supabase, user } = await requireUser();
  const { raw, analysis } = await loadAnalysis();
  if (!raw.profile.ai_enabled) {
    return { ok: false, error: "Turn on AI explanations in Settings first." };
  }

  const { count } = await supabase
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .gte("created_at", istDayStartUTC());
  if ((count ?? 0) >= cfg.dailyLimit) {
    return { ok: false, error: `You've used today's ${cfg.dailyLimit} AI explanations. Try again tomorrow.` };
  }

  let facts: Record<string, unknown>;
  try {
    facts = buildFacts(analysis, feature, goalId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not prepare the request" };
  }
  const payload = JSON.stringify(facts);
  const personal = [
    raw.profile.name,
    user.email ?? "",
    ...raw.goals.map((g) => g.name),
    ...raw.holdings.map((h) => h.name ?? ""),
    ...raw.liabilities.map((l) => l.label ?? ""),
    ...raw.incomes.map((s) => s.label),
  ];
  const vocab = genericVocabulary(analysis);
  const toCheck = personal.filter((s) => s.trim().length >= 3 && !vocab.includes(s.trim().toLowerCase()));
  try {
    assertAnonymous(payload, toCheck);
  } catch {
    return { ok: false, error: "This request was blocked because it might include personal details." };
  }

  const limits = LIMITS[feature];
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `${PROMPTS[feature]} Keep it under ${limits.words} words.\n\nData:\n${payload}` },
  ];

  // Free models first. Paid only if allowed, and first only for complex requests.
  type Attempt = { tier: "free" | "paid"; models: string[] };
  const free: Attempt | null = cfg.freeModels.length ? { tier: "free", models: cfg.freeModels } : null;
  const paid: Attempt | null = cfg.allowPaid && cfg.paidModel ? { tier: "paid", models: [cfg.paidModel] } : null;
  const plan = (limits.complex ? [paid, free] : [free, paid]).filter((a): a is Attempt => a !== null);

  let lastError = "No AI model is configured.";
  for (const attempt of plan) {
    try {
      const res = await chat({
        apiKey: cfg.apiKey,
        models: attempt.models,
        messages,
        maxTokens: limits.tokens,
        dataCollection: attempt.tier === "free" && cfg.freeAllowDataCollection ? "allow" : "deny",
        siteUrl: cfg.siteUrl,
      });
      const text = cleanOutput(res.text);
      const named = findNamedProducts(text);
      await supabase.from("ai_requests").insert({
        user_id: user.id,
        feature,
        model: res.model,
        tier: attempt.tier,
        ok: named.length === 0,
      });
      if (named.length) {
        lastError = "The AI answer mentioned a specific product, so it was hidden.";
        continue;
      }
      return { ok: true, text, tier: attempt.tier };
    } catch (e) {
      lastError = e instanceof Error && e.name === "TimeoutError" ? "The AI took too long to answer." : "The AI service didn't respond.";
    }
  }
  return { ok: false, error: `${lastError} Your plan above still explains itself.` };
}
