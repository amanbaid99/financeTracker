import "server-only";

export interface AiConfig {
  apiKey: string;
  freeModels: string[];
  paidModel: string | null;
  allowPaid: boolean;
  freeAllowDataCollection: boolean;
  dailyLimit: number;
  siteUrl: string;
}

function list(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function aiConfig(): AiConfig | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  const freeModels = list(process.env.OPENROUTER_FREE_MODELS);
  const paidModel = process.env.OPENROUTER_PAID_MODEL?.trim() || null;
  const allowPaid = process.env.OPENROUTER_ALLOW_PAID === "true" && Boolean(paidModel);
  if (freeModels.length === 0 && !allowPaid) return null;
  return {
    apiKey,
    freeModels,
    paidModel,
    allowPaid,
    freeAllowDataCollection: process.env.OPENROUTER_FREE_ALLOW_DATA_COLLECTION === "true",
    dailyLimit: Math.max(1, Number(process.env.AI_DAILY_LIMIT ?? 20) || 20),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  };
}

export function aiConfigured(): boolean {
  return aiConfig() !== null;
}
