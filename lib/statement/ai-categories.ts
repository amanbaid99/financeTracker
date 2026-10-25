import "server-only";

// AI check for fund categories the name rules couldn't place.
// Only scheme names are sent: public fund names, never amounts, units, PAN,
// folio numbers or anything else from the statement.
//
// Two free models must give the same answer. If they disagree, a paid model
// (when allowed) breaks the tie, but only by agreeing with one of them.
// Anything still unsettled is left for the user to pick.

import { chatOnce, openRouterSettings, type AiSettings } from "@/lib/ai/openrouter";
import { FUND_CATEGORIES } from "@/lib/instruments";

export type { AiSettings };

export type AiVerdict = { category: string; how: "two models agreed" | "checked by a third model" } | null;

const ALLOWED = [...FUND_CATEGORIES.map((c) => c.value), "gold"];

/** Category checks need two free models (or a paid tie-breaker) to work. */
export function aiSettings(env: NodeJS.ProcessEnv = process.env): AiSettings | null {
  const s = openRouterSettings(env);
  if (!s || (s.freeModels.length < 2 && !s.allowPaid)) return null;
  return s;
}

function prompt(names: string[]): string {
  const cats = FUND_CATEGORIES.map((c) => `${c.value}: ${c.label}`).join("\n");
  return [
    "Classify each Indian mutual fund scheme below into exactly one category.",
    "Use only these category ids:",
    cats,
    "gold: Gold fund or gold ETF",
    "",
    'Reply with JSON only, like {"results":[{"i":0,"category":"flexi_cap"}]}.',
    "If you are not sure about a scheme, use null for its category.",
    "",
    ...names.map((n, i) => `${i}. ${n}`),
  ].join("\n");
}

type Fetch = typeof fetch;

/** One model's answers by index; empty when the call fails. */
async function ask(model: string, names: string[], s: AiSettings, fetchImpl: Fetch): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const text = await chatOnce(model, [{ role: "user", content: prompt(names) }], s, {
    json: true,
    timeoutMs: 30_000,
    fetchImpl,
  });
  if (!text) return out;
  try {
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as {
      results?: { i?: number; category?: string | null }[];
    };
    for (const r of json.results ?? []) {
      if (typeof r.i === "number" && r.category && ALLOWED.includes(r.category)) out.set(r.i, r.category);
    }
  } catch {
    // A garbled answer counts as no answer.
  }
  return out;
}

/** Categories for scheme names, settled by agreement between models. */
export async function aiCategories(
  names: string[],
  settings: AiSettings | null = aiSettings(),
  fetchImpl: Fetch = fetch,
): Promise<AiVerdict[]> {
  const verdicts: AiVerdict[] = names.map(() => null);
  if (!settings || names.length === 0) return verdicts;
  const [a, b] = await Promise.all(
    settings.freeModels.slice(0, 2).map((m) => ask(m, names, settings, fetchImpl)),
  );
  const open: number[] = [];
  names.forEach((_, i) => {
    const x = a?.get(i);
    const y = b?.get(i);
    if (x && x === y) verdicts[i] = { category: x, how: "two models agreed" };
    else open.push(i);
  });
  if (open.length && settings.allowPaid && settings.paidModel) {
    const paid = await ask(settings.paidModel, open.map((i) => names[i]), settings, fetchImpl);
    open.forEach((i, j) => {
      const z = paid.get(j);
      // The tie-breaker must side with one of the free models.
      if (z && (z === a?.get(i) || z === b?.get(i))) verdicts[i] = { category: z, how: "checked by a third model" };
    });
  }
  return verdicts;
}
