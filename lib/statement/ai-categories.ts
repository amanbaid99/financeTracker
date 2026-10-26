import "server-only";

// AI check for fund categories the name rules couldn't place.
// Only scheme names are sent: public fund names, never amounts, units, PAN,
// folio numbers or anything else from the statement.
//
// Two models from different makers must give the same answer (free ones
// first; see router.ts). If they disagree, a paid model (when allowed) breaks
// the tie, but only by agreeing with one of them. Anything still unsettled is
// left for the user to pick.

import { openRouterSettings, type AiSettings } from "@/lib/ai/openrouter";
import { AiRouter, sharedRouter } from "@/lib/ai/router";
import { FUND_CATEGORIES } from "@/lib/instruments";

export type { AiSettings };

export type AiVerdict = {
  category: string;
  how: "two models agreed" | "checked by a third model";
} | null;

const ALLOWED = [...FUND_CATEGORIES.map((c) => c.value), "gold"];

export function aiSettings(
  env: NodeJS.ProcessEnv = process.env,
): AiSettings | null {
  return openRouterSettings(env);
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

/** One model's answers by index. */
function parse(text: string | undefined): Map<number, string> {
  const out = new Map<number, string>();
  if (!text) return out;
  try {
    const json = JSON.parse(
      text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1),
    ) as {
      results?: { i?: number; category?: string | null }[];
    };
    for (const r of json.results ?? []) {
      if (typeof r.i === "number" && r.category && ALLOWED.includes(r.category))
        out.set(r.i, r.category);
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
  fetchImpl?: Fetch,
  opts: { userMayPay?: boolean } = {},
): Promise<AiVerdict[]> {
  const verdicts: AiVerdict[] = names.map(() => null);
  if (!settings || names.length === 0) return verdicts;
  const router = fetchImpl
    ? new AiRouter(settings, fetchImpl)
    : sharedRouter(settings);
  const msg = (list: string[]) => [
    { role: "user" as const, content: prompt(list) },
  ];

  const readings = await router.readings("categorize", msg(names), 2, opts);
  const [a, b] = readings.map((r) => parse(r.text));
  const open: number[] = [];
  names.forEach((_, i) => {
    const x = a?.get(i);
    const y = b?.get(i);
    if (x && x === y) verdicts[i] = { category: x, how: "two models agreed" };
    else open.push(i);
  });
  if (open.length && readings.length === 2) {
    const tie = await router.tieBreak(
      "categorize",
      msg(open.map((i) => names[i])),
      {
        ...opts,
        notFrom: readings.map((r) => r.model),
      },
    );
    const z = parse(tie?.text);
    open.forEach((i, j) => {
      const c = z.get(j);
      // The tie-breaker must side with one of the two readings.
      if (c && (c === a?.get(i) || c === b?.get(i)))
        verdicts[i] = { category: c, how: "checked by a third model" };
    });
  }
  return verdicts;
}
