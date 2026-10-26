import "server-only";

// OpenRouter settings from the environment. Which model answers each request
// is decided in router.ts.

export interface AiSettings {
  apiKey: string;
  baseUrl: string;
  freeModels: string[];
  paidModel: string | null;
  allowPaid: boolean;
  allowDataCollection: boolean;
  siteUrl: string;
  dailyLimit: number;
  /** Most the app spends on paid models a day, across everyone, in $. */
  paidDailyUsd: number;
  /** Paid requests one person can trigger a day. */
  paidPerUserDaily: number;
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
  // Models are picked automatically (see router.ts); these only add preferences.
  const freeModels = list(env.OPENROUTER_FREE_MODELS);
  const paidModel = env.OPENROUTER_PAID_MODEL?.trim() || null;
  // Paid fallback is on unless turned off; spend is capped below.
  const allowPaid = env.OPENROUTER_ALLOW_PAID !== "false";
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return v && Number.isFinite(n) && n >= 0 ? n : d;
  };
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
    paidDailyUsd: num(env.AI_PAID_DAILY_USD, 0.5),
    paidPerUserDaily: num(env.AI_PAID_PER_USER_DAILY, 10),
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
