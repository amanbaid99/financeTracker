import "server-only";

// Picks which OpenRouter model answers each request, so nothing needs to be
// configured beyond the API key.
//
// - Free models come from OpenRouter's live model list, ranked by size,
//   recency, context and JSON support. Models named in OPENROUTER_FREE_MODELS
//   go first.
// - Checks that need agreement read with two free models from different
//   makers, so one maker's quirk can't confirm itself.
// - A model that fails is rested for a while: a minute after a rate limit,
//   half an hour when it has no provider, longer after repeated errors.
// - Paid models step in only when free ones fail, disagree, or today's free
//   quota is nearly used up. The paid pick is the cheap paid version of a
//   good free model, within a price cap, and within daily spend limits.
// - Paid requests always ask for providers that don't keep or train on data.

import type { AiSettings, ChatMessage } from "@/lib/ai/openrouter";

export type Task = "categorize" | "card_features" | "ask";

interface Policy {
  json: boolean;
  maxTokens: number;
  timeoutMs: number;
  minContext: number;
  /** Highest paid input price allowed, in $ per million tokens. */
  maxPaidInput: number;
}

export const POLICIES: Record<Task, Policy> = {
  categorize: {
    json: true,
    maxTokens: 1500,
    timeoutMs: 30_000,
    minContext: 8_000,
    maxPaidInput: 1,
  },
  card_features: {
    json: true,
    maxTokens: 2_000,
    timeoutMs: 45_000,
    minContext: 32_000,
    maxPaidInput: 1,
  },
  ask: {
    json: false,
    maxTokens: 900,
    timeoutMs: 40_000,
    minContext: 16_000,
    maxPaidInput: 2,
  },
};

export interface ModelInfo {
  id: string;
  free: boolean;
  /** $ per million tokens. */
  input: number;
  output: number;
  context: number;
  json: boolean;
  created: number;
  maker: string;
}

export interface Answer {
  text: string;
  model: string;
  tier: "free" | "paid";
}

type Fetch = typeof fetch;
type Failure =
  | "rate_limited"
  | "daily_quota"
  | "unavailable"
  | "no_credit"
  | "error";

const SKIP =
  /(embed|guard|moderation|rerank|tts|whisper|audio|image|vision|-vl\b|ocr|safety)/i;
const HOUR = 3_600_000;

/** Biggest "NNb" in a model id, as a rough size; unknown sizes count as 30b. */
export function sizeOf(id: string): number {
  const sizes = [
    ...id.toLowerCase().matchAll(/(\d+(?:\.\d+)?)b(?![a-z])/g),
  ].map((m) => Number(m[1]));
  return sizes.length ? Math.max(...sizes) : 30;
}

export function parseCatalogue(json: unknown): ModelInfo[] {
  const data = (json as { data?: unknown[] })?.data;
  if (!Array.isArray(data)) return [];
  const out: ModelInfo[] = [];
  for (const raw of data) {
    const m = raw as {
      id?: string;
      context_length?: number;
      created?: number;
      pricing?: { prompt?: string; completion?: string; request?: string };
      supported_parameters?: string[];
      architecture?: {
        input_modalities?: string[];
        output_modalities?: string[];
      };
    };
    if (
      typeof m.id !== "string" ||
      SKIP.test(m.id) ||
      m.id.startsWith("openrouter/")
    )
      continue;
    const outMods = m.architecture?.output_modalities;
    if (outMods && !outMods.includes("text")) continue;
    const input = Number(m.pricing?.prompt ?? NaN) * 1e6;
    const output = Number(m.pricing?.completion ?? NaN) * 1e6;
    if (
      !Number.isFinite(input) ||
      !Number.isFinite(output) ||
      input < 0 ||
      output < 0
    )
      continue;
    if (Number(m.pricing?.request ?? 0) > 0) continue;
    const params = m.supported_parameters ?? [];
    out.push({
      id: m.id,
      free: m.id.endsWith(":free") || (input === 0 && output === 0),
      input,
      output,
      context: m.context_length ?? 0,
      json:
        params.includes("response_format") ||
        params.includes("structured_outputs"),
      created: m.created ?? 0,
      maker: m.id.split("/")[0],
    });
  }
  return out;
}

/** Higher is better: bigger, newer, longer context, JSON support. */
export function score(m: ModelInfo, policy: Policy, nowMs: number): number {
  const years = m.created ? (m.created * 1000 - nowMs) / (365 * 24 * HOUR) : -2;
  return (
    Math.log2(Math.min(sizeOf(m.id), 1000) + 1) * 2 +
    Math.max(years, -3) * 3 +
    Math.log2(Math.max(m.context, 4_000) / 32_000) * 0.5 +
    (policy.json && m.json ? 2 : 0)
  );
}

interface KeyInfo {
  freeRemaining: number | null;
  creditRemaining: number | null;
  spentToday: number;
}

export class AiRouter {
  private catalogue: { at: number; models: ModelInfo[] } | null = null;
  private key: { at: number; info: KeyInfo | null } | null = null;
  private resting = new Map<string, { until: number; strikes: number }>();
  private freeBlockedUntil = 0;
  private paidBlockedUntil = 0;

  constructor(
    private s: AiSettings,
    private fetchImpl: Fetch = fetch,
    private now: () => number = Date.now,
  ) {}

  // ---------------------------------------------------------------------
  // What's available
  // ---------------------------------------------------------------------

  private headers() {
    return {
      Authorization: `Bearer ${this.s.apiKey}`,
      "HTTP-Referer": this.s.siteUrl,
      "X-Title": "Tracker",
    };
  }

  async models(): Promise<ModelInfo[]> {
    if (this.catalogue && this.now() - this.catalogue.at < 6 * HOUR)
      return this.catalogue.models;
    try {
      const res = await this.fetchImpl(`${this.s.baseUrl}/models`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const models = parseCatalogue(await res.json());
        if (models.length) this.catalogue = { at: this.now(), models };
      }
    } catch {
      // Keep whatever list we had; the preferred models still work.
    }
    if (!this.catalogue)
      this.catalogue = { at: this.now() - 5.9 * HOUR, models: [] }; // retry in ~6 min
    return this.catalogue.models;
  }

  /** Today's free quota and credit, checked at most once a minute. */
  async keyInfo(): Promise<KeyInfo | null> {
    if (this.key && this.now() - this.key.at < 60_000) return this.key.info;
    let info: KeyInfo | null = null;
    try {
      const res = await this.fetchImpl(`${this.s.baseUrl}/key`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const d =
          ((await res.json()) as { data?: Record<string, unknown> }).data ?? {};
        const free = d.free_model_daily_requests as
          | { remaining?: number }
          | undefined;
        info = {
          freeRemaining:
            typeof free?.remaining === "number" ? free.remaining : null,
          creditRemaining:
            typeof d.limit_remaining === "number" ? d.limit_remaining : null,
          spentToday: typeof d.usage_daily === "number" ? d.usage_daily : 0,
        };
      }
    } catch {
      // Unknown is treated as "probably fine"; failures still fall back.
    }
    this.key = { at: this.now(), info };
    return info;
  }

  private isResting(id: string) {
    const r = this.resting.get(id);
    return Boolean(r && r.until > this.now());
  }

  /** Free models to try, best first. */
  async freeModels(task: Task): Promise<string[]> {
    if (this.freeBlockedUntil > this.now()) return [];
    const info = await this.keyInfo();
    if (
      info?.freeRemaining !== null &&
      info?.freeRemaining !== undefined &&
      info.freeRemaining < 3
    )
      return [];
    const p = POLICIES[task];
    const listed = (await this.models())
      .filter((m) => m.free && m.context >= p.minContext)
      .sort((a, b) => score(b, p, this.now()) - score(a, p, this.now()))
      .map((m) => m.id);
    const ids = [...new Set([...this.s.freeModels, ...listed])];
    return ids.filter((id) => !this.isResting(id));
  }

  /** Paid models to use, best first; empty when paid use isn't allowed or affordable. */
  async paidModels(task: Task, userMayPay = true): Promise<string[]> {
    if (!this.s.allowPaid || !userMayPay || this.paidBlockedUntil > this.now())
      return [];
    const info = await this.keyInfo();
    if (info) {
      if (info.creditRemaining !== null && info.creditRemaining < 0.05)
        return [];
      if (info.spentToday >= this.s.paidDailyUsd) return [];
    }
    const p = POLICIES[task];
    const all = await this.models();
    const byId = new Map(all.map((m) => [m.id, m]));
    const cheap = (m: ModelInfo | undefined): m is ModelInfo =>
      !!m &&
      !m.free &&
      m.input <= p.maxPaidInput &&
      m.output <= p.maxPaidInput * 4 &&
      m.context >= p.minContext &&
      (!p.json || m.json);
    // The paid version of a good free model first, then any cheap good model.
    const twins = (await this.freeModelsRanked(task))
      .map((id) => byId.get(id.replace(/:free$/, "")))
      .filter(cheap)
      .map((m) => m.id);
    const others = all
      .filter(cheap)
      .sort((a, b) => score(b, p, this.now()) - score(a, p, this.now()))
      .map((m) => m.id);
    const ids = [
      ...new Set([
        ...(this.s.paidModel ? [this.s.paidModel] : []),
        ...twins,
        ...others,
      ]),
    ];
    return ids.filter((id) => !this.isResting(id)).slice(0, 5);
  }

  private async freeModelsRanked(task: Task): Promise<string[]> {
    const p = POLICIES[task];
    return (await this.models())
      .filter((m) => m.free)
      .sort((a, b) => score(b, p, this.now()) - score(a, p, this.now()))
      .map((m) => m.id);
  }

  // ---------------------------------------------------------------------
  // Calling
  // ---------------------------------------------------------------------

  private rest(id: string, why: Failure, retryAfterMs?: number) {
    const prev = this.resting.get(id)?.strikes ?? 0;
    const strikes = prev + 1;
    const ms =
      why === "rate_limited"
        ? (retryAfterMs ?? 60_000)
        : why === "unavailable"
          ? 30 * 60_000
          : Math.min(2 ** strikes * 30_000, 15 * 60_000);
    this.resting.set(id, { until: this.now() + ms, strikes });
  }

  /** One call. Returns the text, or records why it failed and returns null. */
  async call(
    model: string,
    messages: ChatMessage[],
    task: Task,
    paid: boolean,
  ): Promise<Answer | null> {
    const p = POLICIES[task];
    const denyLogging = paid || !this.s.allowDataCollection;
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.s.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: p.json ? 0 : 0.3,
          max_tokens: p.maxTokens,
          ...(p.json ? { response_format: { type: "json_object" } } : {}),
          messages,
          ...(denyLogging ? { provider: { data_collection: "deny" } } : {}),
        }),
        signal: AbortSignal.timeout(p.timeoutMs),
      });
    } catch {
      this.rest(model, "error");
      return null;
    }
    if (!res.ok) {
      const reset = Number(res.headers.get("X-RateLimit-Reset") ?? NaN);
      const retry = Number(res.headers.get("Retry-After") ?? NaN);
      if (res.status === 429) {
        // A reset hours away means the daily free quota is used up.
        if (
          !paid &&
          Number.isFinite(reset) &&
          reset - this.now() > 10 * 60_000
        ) {
          this.freeBlockedUntil = reset;
        } else {
          this.rest(
            model,
            "rate_limited",
            Number.isFinite(retry) ? retry * 1000 : undefined,
          );
        }
      } else if (res.status === 402) {
        if (paid) this.paidBlockedUntil = this.now() + 10 * 60_000;
        else this.rest(model, "error");
      } else if (res.status === 404 || res.status === 400) {
        this.rest(model, "unavailable");
      } else {
        this.rest(model, "error");
      }
      return null;
    }
    let text = "";
    try {
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      text = data.choices?.[0]?.message?.content?.trim() ?? "";
    } catch {
      // Unreadable reply.
    }
    const usable = p.json
      ? text.includes("{") && text.includes("}")
      : text.length >= 2;
    if (!usable) {
      this.rest(model, "error");
      return null;
    }
    this.resting.delete(model);
    return { text, model, tier: paid ? "paid" : "free" };
  }

  /** One answer: free models in order (up to three tries), then paid. */
  async answer(
    task: Task,
    messages: ChatMessage[],
    opts: { userMayPay?: boolean } = {},
  ): Promise<Answer | null> {
    for (const id of (await this.freeModels(task)).slice(0, 3)) {
      const a = await this.call(id, messages, task, false);
      if (a) return a;
    }
    for (const paid of (await this.paidModels(task, opts.userMayPay)).slice(
      0,
      2,
    )) {
      const a = await this.call(paid, messages, task, true);
      if (a) return a;
    }
    return null;
  }

  /**
   * Independent readings for checks that need agreement: free models from
   * different makers, run side by side, with one retry per failed slot. A
   * paid model fills in only if fewer than `n` free readings came back.
   */
  async readings(
    task: Task,
    messages: ChatMessage[],
    n = 2,
    opts: { userMayPay?: boolean } = {},
  ): Promise<Answer[]> {
    const free = await this.freeModels(task);
    const makers = new Set<string>();
    const first: string[] = [];
    for (const id of free) {
      const maker = id.split("/")[0];
      if (makers.has(maker)) continue;
      makers.add(maker);
      first.push(id);
      if (first.length === n) break;
    }
    // Fewer makers than slots: fill with whatever is left.
    for (const id of free)
      if (first.length < n && !first.includes(id)) first.push(id);
    const spare = free.filter((id) => !first.includes(id));

    const got = await Promise.all(
      first.map(async (id) => {
        const a = await this.call(id, messages, task, false);
        if (a) return a;
        const next = spare.shift();
        return next ? this.call(next, messages, task, false) : null;
      }),
    );
    const out = got.filter((a): a is Answer => a !== null);
    // Not enough free readings: fill with paid ones, each from a new maker.
    if (out.length < n) {
      const used = new Set(out.map((a) => a.model.split("/")[0]));
      for (const id of await this.paidModels(task, opts.userMayPay)) {
        if (out.length >= n) break;
        if (used.has(id.split("/")[0]) && out.length + 1 < n) continue;
        const a = await this.call(id, messages, task, true);
        if (a) {
          out.push(a);
          used.add(id.split("/")[0]);
        }
      }
    }
    return out;
  }

  /** A paid reading to settle a disagreement, when allowed. */
  async tieBreak(
    task: Task,
    messages: ChatMessage[],
    opts: { userMayPay?: boolean; notFrom?: string[] } = {},
  ): Promise<Answer | null> {
    // Prefer a model that hasn't already given a reading.
    const ids = await this.paidModels(task, opts.userMayPay);
    const fresh = ids.filter((id) => !opts.notFrom?.includes(id));
    for (const id of [...fresh, ...ids].slice(0, 2)) {
      const a = await this.call(id, messages, task, true);
      if (a) return a;
    }
    return null;
  }
}

let shared: { key: string; router: AiRouter } | null = null;

/** One router per server instance, so model health and caches carry over. */
export function sharedRouter(s: AiSettings): AiRouter {
  const key = `${s.apiKey}|${s.baseUrl}`;
  if (!shared || shared.key !== key) shared = { key, router: new AiRouter(s) };
  return shared.router;
}
