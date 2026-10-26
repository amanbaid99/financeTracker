import { describe, expect, it, vi } from "vitest";
import type { AiSettings } from "@/lib/ai/openrouter";
import { AiRouter, parseCatalogue, sizeOf } from "@/lib/ai/router";

vi.mock("server-only", () => ({}));

const NOW = Date.UTC(2026, 9, 26, 6);
const S: AiSettings = {
  apiKey: "k",
  baseUrl: "https://or.test/api/v1",
  freeModels: [],
  paidModel: null,
  allowPaid: true,
  allowDataCollection: false,
  siteUrl: "http://x",
  dailyLimit: 20,
  paidDailyUsd: 0.5,
  paidPerUserDaily: 10,
};
const day = 86_400;
const model = (
  id: string,
  o: Partial<{
    in: number;
    out: number;
    ctx: number;
    json: boolean;
    ageDays: number;
  }> = {},
) => ({
  id,
  context_length: o.ctx ?? 128_000,
  created: NOW / 1000 - (o.ageDays ?? 60) * day,
  pricing: {
    prompt: String((o.in ?? 0) / 1e6),
    completion: String((o.out ?? 0) / 1e6),
  },
  supported_parameters:
    o.json === false ? ["temperature"] : ["response_format", "temperature"],
  architecture: { input_modalities: ["text"], output_modalities: ["text"] },
});
const CATALOGUE = {
  data: [
    model("nvidia/nemotron-super-120b:free"),
    model("nvidia/nemotron-super-120b", { in: 0.1, out: 0.4 }),
    model("qwen/qwen3-235b-a22b:free"),
    model("meta/llama-3.2-3b:free"),
    model("google/gemma-27b:free", { ageDays: 400 }),
    model("openai/big-model", { in: 5, out: 15 }),
    model("acme/embed-large:free"),
    model("acme/cheap-chat", { in: 0.2, out: 0.6 }),
  ],
};

type Handler = (model: string) => Response;
function fake(chat: Handler, key: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/models")) return Response.json(CATALOGUE);
    if (u.endsWith("/key")) return Response.json({ data: key });
    const body = JSON.parse(String(init?.body));
    calls.push(body.model);
    return chat(body.model);
  }) as unknown as typeof fetch;
  return { f, calls };
}
const ok = (text: string) =>
  Response.json({ choices: [{ message: { content: text } }] });
const fail = (status: number, headers: Record<string, string> = {}) =>
  new Response("{}", { status, headers });
const msgs = [{ role: "user" as const, content: "hi" }];

describe("catalogue", () => {
  it("reads sizes from ids", () => {
    expect(sizeOf("qwen/qwen3-235b-a22b:free")).toBe(235);
    expect(sizeOf("x/unknown")).toBe(30);
  });
  it("drops non-chat models", () => {
    expect(parseCatalogue(CATALOGUE).map((m) => m.id)).not.toContain(
      "acme/embed-large:free",
    );
  });
});

describe("AiRouter", () => {
  it("ranks big, recent free models first", async () => {
    const r = new AiRouter(S, fake(() => ok("{}")).f, () => NOW);
    const free = await r.freeModels("card_features");
    expect(free.slice(0, 2).sort()).toEqual([
      "nvidia/nemotron-super-120b:free",
      "qwen/qwen3-235b-a22b:free",
    ]);
    expect(free.at(-1)).toBe("meta/llama-3.2-3b:free");
  });

  it("puts preferred models first", async () => {
    const r = new AiRouter(
      { ...S, freeModels: ["meta/llama-3.2-3b:free"] },
      fake(() => ok("{}")).f,
      () => NOW,
    );
    expect((await r.freeModels("ask"))[0]).toBe("meta/llama-3.2-3b:free");
  });

  it("reads with two different makers, for free", async () => {
    const { f, calls } = fake(() => ok('{"a":1}'));
    const out = await new AiRouter(S, f, () => NOW).readings(
      "categorize",
      msgs,
      2,
    );
    expect(out.map((a) => a.tier)).toEqual(["free", "free"]);
    expect(new Set(calls.map((c) => c.split("/")[0])).size).toBe(2);
  });

  it("retries a failed slot with the next free model, then rests the failed one", async () => {
    let t = NOW;
    const { f, calls } = fake((m) =>
      m.startsWith("qwen/")
        ? fail(429, { "Retry-After": "30" })
        : ok('{"a":1}'),
    );
    const r = new AiRouter(S, f, () => t);
    const out = await r.readings("categorize", msgs, 2);
    expect(out).toHaveLength(2);
    expect(out.every((a) => a.tier === "free")).toBe(true);
    expect(calls).toContain("qwen/qwen3-235b-a22b:free");
    expect(await r.freeModels("categorize")).not.toContain(
      "qwen/qwen3-235b-a22b:free",
    );
    t += 31_000;
    expect(await r.freeModels("categorize")).toContain(
      "qwen/qwen3-235b-a22b:free",
    );
  });

  it("goes to the cheap paid twin of a free model when free ones fail", async () => {
    const { f, calls } = fake((m) =>
      m.endsWith(":free") ? fail(503) : ok("Here you go"),
    );
    const a = await new AiRouter(S, f, () => NOW).answer("ask", msgs);
    expect(a).toMatchObject({
      tier: "paid",
      model: "nvidia/nemotron-super-120b",
    });
    expect(calls).not.toContain("openai/big-model"); // over the price cap
  });

  it("skips free models when today's free quota is nearly used", async () => {
    const { f, calls } = fake(() => ok("Answer"), {
      free_model_daily_requests: { remaining: 1 },
    });
    const a = await new AiRouter(S, f, () => NOW).answer("ask", msgs);
    expect(a?.tier).toBe("paid");
    expect(calls.every((c) => !c.endsWith(":free"))).toBe(true);
  });

  it("stops free models for the day after a daily-quota 429", async () => {
    const reset = String(NOW + 10 * 3_600_000);
    const { f } = fake((m) =>
      m.endsWith(":free")
        ? fail(429, { "X-RateLimit-Reset": reset })
        : ok("ok!"),
    );
    const r = new AiRouter(S, f, () => NOW);
    await r.answer("ask", msgs);
    expect(await r.freeModels("ask")).toEqual([]);
  });

  it("never pays past the daily spend cap, when paid is off, or past the person's cap", async () => {
    const failFree = (m: string) =>
      m.endsWith(":free") ? fail(503) : ok("paid answer");
    expect(
      await new AiRouter(
        S,
        fake(failFree, { usage_daily: 0.6 }).f,
        () => NOW,
      ).answer("ask", msgs),
    ).toBeNull();
    expect(
      await new AiRouter(
        { ...S, allowPaid: false },
        fake(failFree).f,
        () => NOW,
      ).answer("ask", msgs),
    ).toBeNull();
    expect(
      await new AiRouter(S, fake(failFree).f, () => NOW).answer("ask", msgs, {
        userMayPay: false,
      }),
    ).toBeNull();
    expect(
      await new AiRouter(
        S,
        fake(failFree, { limit_remaining: 0.01 }).f,
        () => NOW,
      ).answer("ask", msgs),
    ).toBeNull();
  });

  it("asks paid providers not to keep data, always", async () => {
    const bodies: Record<string, unknown>[] = [];
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/models")) return Response.json(CATALOGUE);
      if (u.endsWith("/key")) return Response.json({ data: {} });
      const b = JSON.parse(String(init?.body));
      bodies.push(b);
      return b.model.endsWith(":free") ? fail(503) : ok("fine");
    }) as unknown as typeof fetch;
    await new AiRouter(
      { ...S, allowDataCollection: true },
      f,
      () => NOW,
    ).answer("ask", msgs);
    expect(
      bodies.find((b) => !String(b.model).endsWith(":free"))?.provider,
    ).toEqual({ data_collection: "deny" });
    expect(
      bodies.find((b) => String(b.model).endsWith(":free"))?.provider,
    ).toBeUndefined();
  });

  it("tie-breaks with a model that hasn't already answered", async () => {
    const { f, calls } = fake(() => ok('{"x":1}'));
    const r = new AiRouter(
      { ...S, paidModel: "acme/cheap-chat" },
      f,
      () => NOW,
    );
    const t = await r.tieBreak("categorize", msgs, {
      notFrom: ["acme/cheap-chat"],
    });
    expect(t?.tier).toBe("paid");
    expect(calls).toEqual(["nvidia/nemotron-super-120b"]);
  });
});
