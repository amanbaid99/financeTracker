import { describe, expect, it, vi } from "vitest";
import { aiCategories, type AiSettings } from "@/lib/statement/ai-categories";
import { placeFromName } from "@/lib/statement/categories";
import {
  applyAiCategories,
  buildReview,
  nameSimilarity,
  parsedStatementSchema,
  type ExistingInvestment,
  type ParsedHolding,
  type ParsedStatement,
} from "@/lib/statement/review";

describe("category rules", () => {
  it.each([
    ["Parag Parikh Flexi Cap Fund - Direct Plan Growth", "flexi_cap"],
    ["DSP Liquidity Fund - Direct Growth", null], // "Liquidity" isn't "liquid": left for the AI
    ["Edelweiss Liquid Fund - Direct Growth", "liquid_fund"],
    ["Kotak Equity Arbitrage Fund", "arbitrage"],
    ["UTI Nifty 50 Index Fund", "equity_index"],
    ["Mirae Asset ELSS Tax Saver Fund", "elss"],
    ["ICICI Prudential Banking & PSU Debt Fund", "corporate_bond"],
    ["Nippon India Small Cap Fund", "mid_small_cap"],
    ["Motilal Oswal Nasdaq 100 FOF", "international"],
    ["HDFC Balanced Advantage Fund", "balanced_advantage"],
    ["SBI Gold ETF", "gold"],
    ["ICICI Prudential Pharma Healthcare and Diagnostics Fund", "sectoral_thematic"],
  ])("%s", (name, category) => {
    expect(placeFromName(name)?.category ?? null).toBe(category);
  });

  it("won't guess against the statement's own fund type", () => {
    expect(placeFromName("Some Index Fund", "DEBT")).toBeNull();
    expect(placeFromName("Gold Fund", "EQUITY")).toEqual({ kind: "gold", category: "gold" });
  });
});

const h = (over: Partial<ParsedHolding> & { key: string; name: string }): ParsedHolding => ({
  kind: "mutual_fund",
  isin: over.key,
  amc: null,
  fundType: null,
  units: 10,
  nav: 100,
  value: 1000,
  navDate: "2026-09-30",
  sipMonthly: null,
  lastSipDate: null,
  count: 1,
  issues: [],
  ...over,
});
const statement = (holdings: ParsedHolding[], detailed = true): ParsedStatement => ({
  source: "CAMS",
  detailed,
  statementDate: "2026-09-30",
  holdings,
  warnings: [],
});
const inv = (over: Partial<ExistingInvestment> & { id: string }): ExistingInvestment => ({
  kind: "mutual_fund",
  name: null,
  category: "other",
  value: 0,
  monthlySip: 0,
  returnPct: null,
  isin: null,
  ...over,
});

describe("review rows", () => {
  it("matches by ISIN first, then by name with a question", () => {
    const rows = buildReview(
      statement([
        h({ key: "INF1", name: "Parag Parikh Flexi Cap Fund - Direct Growth", value: 250_000, sipMonthly: 10_000 }),
        h({ key: "INF2", name: "DSP Liquidity Fund - Direct Growth", value: 231_400 }),
        h({ key: "INF3", name: "Brand New Small Cap Fund", value: 5_000 }),
      ]),
      [
        inv({ id: "a", name: "My flexi", isin: "INF1", category: "flexi_cap", value: 240_000, monthlySip: 10_000 }),
        inv({ id: "b", name: "DSP liquid fund", value: 228_000 }),
      ],
    );
    expect(rows.map((r) => r.match?.how ?? null)).toEqual(["isin", null, null]);
    expect(rows[0]).toMatchObject({ category: "flexi_cap", categoryHow: "yours", sip: 10_000, questions: [] });
    // "DSP liquid fund" vs "DSP Liquidity Fund": not alike enough to merge silently.
    expect(nameSimilarity("DSP Liquidity Fund - Direct Growth", "DSP liquid fund")).toBeLessThan(0.5);
    expect(rows[2]).toMatchObject({ category: "mid_small_cap", categoryHow: "from its name", sip: 0 });
  });

  it("asks before matching by name, and asks when two investments look alike", () => {
    const rows = buildReview(statement([h({ key: "INF9", name: "Axis Bluechip Fund - Direct Growth" })]), [
      inv({ id: "x", name: "Axis Bluechip" }),
    ]);
    expect(rows[0].match).toMatchObject({ id: "x", how: "name" });
    expect(rows[0].questions).toEqual([{ kind: "confirm_match", text: "Is this your “Axis Bluechip”?" }]);
    const two = buildReview(statement([h({ key: "INF9", name: "Axis Bluechip Fund" })]), [
      inv({ id: "x", name: "Axis Bluechip" }),
      inv({ id: "y", name: "Bluechip (Axis)" }),
    ]);
    expect(two[0].questions.map((q) => q.kind)).toEqual(["which_match"]);
    expect(two[0].candidates.map((c) => c.id)).toEqual(["x", "y"]);
  });

  it("flags a SIP that seems to have stopped, and keeps SIPs from summary statements", () => {
    const rows = buildReview(statement([h({ key: "INF1", name: "Some Index Fund", sipMonthly: null })]), [
      inv({ id: "a", isin: "INF1", monthlySip: 5_000 }),
    ]);
    expect(rows[0].sip).toBe(0);
    expect(rows[0].questions[0]).toMatchObject({ kind: "sip_stopped", previousSip: 5_000 });
    expect(rows[0].questions[0].text).toMatch(/₹5,000 a month SIP stopped/);
    const summary = buildReview(statement([h({ key: "INF1", name: "Some Index Fund" })], false), [
      inv({ id: "a", isin: "INF1", monthlySip: 5_000 }),
    ]);
    expect(summary[0].sip).toBeNull();
    expect(summary[0].questions).toEqual([]);
  });

  it("places demat stocks and NPS without AI", () => {
    const rows = buildReview(
      statement([
        h({ key: "DEMAT-STOCKS", name: "Stocks in demat", kind: "stock", isin: null }),
        h({ key: "NPS", name: "NPS", kind: "nps", isin: null }),
      ]),
      [],
    );
    expect(rows.map((r) => [r.kind, r.category, r.isin])).toEqual([
      ["stock", "direct_equity", "DEMAT-STOCKS"],
      ["nps", "nps", "NPS"],
    ]);
  });

  it("uses AI answers where rules gave none, and asks about the rest", () => {
    const rows = buildReview(
      statement([h({ key: "A", name: "Mystery Fund One" }), h({ key: "B", name: "Mystery Fund Two" })]),
      [],
    );
    const out = applyAiCategories(rows, new Map([["A", { category: "flexi_cap", how: "two models agreed" as const }]]));
    expect(out[0]).toMatchObject({ category: "flexi_cap", categoryHow: "two models agreed", questions: [] });
    expect(out[1]).toMatchObject({ category: null, questions: [{ kind: "category" }] });
  });

  it("validates what the reader returns", () => {
    expect(parsedStatementSchema.safeParse(statement([h({ key: "A", name: "x" })])).success).toBe(true);
    expect(parsedStatementSchema.safeParse({ ...statement([]), holdings: [] }).success).toBe(false);
  });
});

describe("AI category agreement", () => {
  const settings: AiSettings = {
    apiKey: "k",
    baseUrl: "https://openrouter.ai/api/v1",
    dailyLimit: 20,
    freeModels: ["free-a", "free-b"],
    paidModel: "paid",
    allowPaid: true,
    allowDataCollection: false,
    siteUrl: "http://x",
    paidDailyUsd: 0.5,
    paidPerUserDaily: 10,
  };
  const reply = (results: { i: number; category: string | null }[]) =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ results }) } }] }));

  function fakeFetch(answers: Record<string, { i: number; category: string | null }[]>) {
    return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (!String(url).endsWith("/chat/completions")) return new Response("{}", { status: 404 });
      const body = JSON.parse(String(init?.body));
      return reply(answers[body.model] ?? []);
    }) as unknown as typeof fetch;
  }

  it("accepts answers two free models agree on, and only sends names", async () => {
    const f = fakeFetch({
      "free-a": [{ i: 0, category: "flexi_cap" }, { i: 1, category: "gilt" }],
      "free-b": [{ i: 0, category: "flexi_cap" }, { i: 1, category: "gilt" }],
    });
    const out = await aiCategories(["Fund X", "Fund Y"], settings, f);
    expect(out).toEqual([
      { category: "flexi_cap", how: "two models agreed" },
      { category: "gilt", how: "two models agreed" },
    ]);
    const chats = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.filter(([u]) =>
      String(u).endsWith("/chat/completions"),
    );
    expect(chats).toHaveLength(2); // no paid call needed
    const sent = JSON.parse(String(chats[0][1].body));
    expect(sent.provider).toEqual({ data_collection: "deny" });
    expect(sent.messages[0].content).not.toMatch(/₹|units|PAN|folio/i);
  });

  it("lets the paid model settle a disagreement only by siding with one", async () => {
    const f = fakeFetch({
      "free-a": [{ i: 0, category: "flexi_cap" }, { i: 1, category: "gilt" }],
      "free-b": [{ i: 0, category: "large_cap" }, { i: 1, category: "debt_fund" }],
      // Asked only about the two disputed names, re-indexed from 0.
      paid: [{ i: 0, category: "large_cap" }, { i: 1, category: "liquid_fund" }],
    });
    const out = await aiCategories(["Fund X", "Fund Y"], settings, f);
    expect(out[0]).toEqual({ category: "large_cap", how: "checked by a third model" });
    expect(out[1]).toBeNull(); // the paid model's answer matched neither
  });

  it("ignores unknown categories, bad replies, and works with AI off", async () => {
    const f = vi.fn(async () => new Response("not json")) as unknown as typeof fetch;
    expect(await aiCategories(["Fund X"], settings, f)).toEqual([null]);
    const g = fakeFetch({ "free-a": [{ i: 0, category: "crypto" }], "free-b": [{ i: 0, category: "crypto" }] });
    expect(await aiCategories(["Fund X"], { ...settings, allowPaid: false }, g)).toEqual([null]);
    expect(await aiCategories(["Fund X"], null)).toEqual([null]);
  });
});
