import "server-only";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface OpenRouterResult {
  text: string;
  model: string;
}

/**
 * One chat completion through OpenRouter. `models` is tried in order by
 * OpenRouter itself. `dataCollection: "deny"` restricts routing to providers
 * that don't store or train on prompts.
 */
export async function chat(opts: {
  apiKey: string;
  models: string[];
  messages: ChatMessage[];
  maxTokens: number;
  dataCollection: "allow" | "deny";
  siteUrl: string;
  timeoutMs?: number;
}): Promise<OpenRouterResult> {
  const [model, ...fallbacks] = opts.models;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": opts.siteUrl,
      "X-Title": "Tracker",
    },
    body: JSON.stringify({
      model,
      ...(fallbacks.length ? { models: opts.models } : {}),
      messages: opts.messages,
      max_tokens: opts.maxTokens,
      temperature: 0.3,
      provider: { data_collection: opts.dataCollection },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
    cache: "no-store",
  });
  if (!res.ok) {
    // Never log the request body; it is only status and a short error here.
    const err = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (json.error) throw new Error(json.error.message ?? "OpenRouter error");
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Empty response");
  return { text, model: json.model ?? model };
}
