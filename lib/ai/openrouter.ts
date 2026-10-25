import "server-only";

// Shared OpenRouter settings and one chat call. Free models are tried in
// order; a paid model is used only when allowed and every free one fails.

export interface AiSettings {
  apiKey: string;
  baseUrl: string;
  freeModels: string[];
  paidModel: string | null;
  allowPaid: boolean;
  allowDataCollection: boolean;
  siteUrl: string;
  dailyLimit: number;
}

function list(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Settings from the environment, or null when AI isn't set up. */
export function openRouterSettings(
  env: NodeJS.ProcessEnv = process.env,
): AiSettings | null {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  const freeModels = list(env.OPENROUTER_FREE_MODELS);
  const paidModel = env.OPENROUTER_PAID_MODEL?.trim() || null;
  const allowPaid = env.OPENROUTER_ALLOW_PAID === "true" && Boolean(paidModel);
  if (!freeModels.length && !allowPaid) return null;
  return {
    apiKey,
    baseUrl: (
      env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1"
    ).replace(/\/$/, ""),
    freeModels,
    paidModel,
    allowPaid,
    allowDataCollection: env.OPENROUTER_FREE_ALLOW_DATA_COLLECTION === "true",
    siteUrl: env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    dailyLimit: Math.max(1, Number(env.AI_DAILY_LIMIT ?? 20) || 20),
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

type Fetch = typeof fetch;

/** One model's reply text, or null if the call failed. */
export async function chatOnce(
  model: string,
  messages: ChatMessage[],
  s: AiSettings,
  opts: { json?: boolean; timeoutMs?: number; fetchImpl?: Fetch } = {},
): Promise<string | null> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${s.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${s.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": s.siteUrl,
        "X-Title": "Tracker",
      },
      body: JSON.stringify({
        model,
        temperature: opts.json ? 0 : 0.3,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        messages,
        ...(s.allowDataCollection
          ? {}
          : { provider: { data_collection: "deny" } }),
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}

/** Free models in order, then the paid one if allowed. */
export async function chatWithFallback(
  messages: ChatMessage[],
  s: AiSettings,
  fetchImpl?: Fetch,
): Promise<{ text: string; model: string; tier: "free" | "paid" } | null> {
  for (const model of s.freeModels) {
    const text = await chatOnce(model, messages, s, { fetchImpl });
    if (text) return { text, model, tier: "free" };
  }
  if (s.allowPaid && s.paidModel) {
    const text = await chatOnce(s.paidModel, messages, s, { fetchImpl });
    if (text) return { text, model: s.paidModel, tier: "paid" };
  }
  return null;
}
