import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPortfolio } from "@/lib/portfolio-review/checks";
import { AI_CONSENT_VERSION } from "@/lib/legal";
import { schedulePortfolioReview } from "@/lib/portfolio-review/service";

const mocks = vi.hoisted(() => ({ after: vi.fn(), read: vi.fn(), answer: vi.fn(), pay: vi.fn(), settings: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data", () => ({ readGoals: mocks.read }));
vi.mock("@/lib/ai/budget", () => ({ userMayPay: mocks.pay }));
vi.mock("@/lib/ai/openrouter", () => ({ openRouterSettings: mocks.settings }));
vi.mock("@/lib/ai/router", () => ({ sharedRouter: () => ({ answer: mocks.answer }) }));

type Row = Record<string, unknown>;
function database() {
  const rows: Record<string, Row[]> = {
    portfolio_reviews: [{ user_id: "u", enabled: true, revision: "old", baseline: null }],
    profiles: [{ user_id: "u", ai_enabled: true }],
    consents: [{ user_id: "u", kind: "ai_processing", version: AI_CONSENT_VERSION, granted: true }],
    ai_requests: [],
  };
  const from = (table: string) => {
    let operation = "select";
    let patch: Row = {};
    let one = false;
    let count = false;
    const filters: [string, unknown][] = [];
    const query = {
      select: (_?: string, options?: { count?: string }) => { count = Boolean(options?.count); return query; },
      eq: (key: string, value: unknown) => { filters.push([key,value]); return query; },
      gte: () => query, order: () => query, limit: () => query,
      maybeSingle: () => { one = true; return query; },
      single: () => { one = true; return query; },
      update: (value: Row) => { operation = "update"; patch = value; return query; },
      insert: (value: Row) => { operation = "insert"; patch = value; return query; },
      then: (resolve: (result: unknown) => unknown) => {
        let data = rows[table].filter(r => filters.every(([k,v]) => r[k] === v));
        if (operation === "update") data.forEach(r => Object.assign(r, patch));
        if (operation === "insert") { const row = { id: "attempt", ...patch }; rows[table].push(row); data = [row]; }
        return Promise.resolve(resolve({ data: one ? data[0] ?? null : data, error: null, count: count ? data.length : null }));
      },
    };
    return query;
  };
  return { rows, client: { from } as unknown as Parameters<typeof schedulePortfolioReview>[0] };
}
const input = { today: "2026-10-29", goals: [], links: [], investments: [{ id: "i", name: "PRIVATE", kind: "mutual_fund", category: "equity_index", value: 100000, monthlySip: 1000, returnPct: null }] };
async function finish() { await mocks.after.mock.calls.at(-1)![0](); }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.settings.mockReturnValue({ dailyLimit: 20 });
  mocks.read.mockResolvedValue(input);
  mocks.answer.mockResolvedValue({ text: '{"order":["F1"]}', model: "test", tier: "free" });
  mocks.pay.mockResolvedValue(false);
});

describe("automatic portfolio reviews", () => {
  it("queues a full CAS review after saving, stores validated results and never sends names", async () => {
    const { rows, client } = database();
    await schedulePortfolioReview(client, "u", "cas");
    expect(rows.portfolio_reviews[0].state).toBe("pending");
    expect(mocks.answer).not.toHaveBeenCalled();
    await finish();
    expect(rows.portfolio_reviews[0].state).toBe("ready");
    expect(rows.portfolio_reviews[0].baseline).toBeTruthy();
    expect(JSON.stringify(mocks.answer.mock.calls)).not.toContain("PRIVATE");
    expect(rows.ai_requests.find(r => r.feature === "portfolio_review")?.ok).toBe(true);
  });
  it("always reviews a confirmed CAS even if its numbers are unchanged", async () => {
    const { rows, client } = database();
    rows.portfolio_reviews[0].baseline = checkPortfolio(input).snapshot;
    await schedulePortfolioReview(client, "u", "cas");
    await finish();
    expect(mocks.answer).toHaveBeenCalledOnce();
  });
  it("skips AI for unchanged balances and keeps the last reviewed baseline", async () => {
    const { rows, client } = database();
    const baseline = checkPortfolio(input).snapshot;
    rows.portfolio_reviews[0].baseline = baseline;
    await schedulePortfolioReview(client, "u", "balance");
    await finish();
    expect(mocks.answer).not.toHaveBeenCalled();
    expect(rows.portfolio_reviews[0].state).toBe("basic");
    expect(rows.portfolio_reviews[0].baseline).toEqual(baseline);
  });
  it("sends a balance review when a major change occurs", async () => {
    const { rows, client } = database();
    rows.portfolio_reviews[0].baseline = { ...checkPortfolio(input).snapshot, total: 50000 };
    await schedulePortfolioReview(client, "u", "balance");
    await finish();
    expect(mocks.answer).toHaveBeenCalledOnce();
  });
  it("requires both automatic-review opt-in and current AI consent", async () => {
    const { rows, client } = database();
    rows.portfolio_reviews[0].enabled = false;
    await schedulePortfolioReview(client, "u", "cas");
    expect(mocks.after).not.toHaveBeenCalled();
    rows.portfolio_reviews[0].enabled = true;
    rows.consents[0].granted = false;
    await schedulePortfolioReview(client, "u", "cas");
    await finish();
    expect(mocks.answer).not.toHaveBeenCalled();
    expect(rows.portfolio_reviews[0].state).toBe("unavailable");
  });
  it("does not overwrite a newer job or a disabled review", async () => {
    const { rows, client } = database();
    await schedulePortfolioReview(client, "u", "cas");
    mocks.answer.mockImplementationOnce(async () => {
      rows.portfolio_reviews[0].revision = "newer";
      rows.portfolio_reviews[0].state = "pending";
      return { text: '{"order":["F1"]}', model: "test", tier: "free" };
    });
    await finish();
    expect(rows.portfolio_reviews[0].state).toBe("pending");
    expect(rows.portfolio_reviews[0].baseline).toBeNull();
  });
  it("falls back to calculated checks on malformed output or unavailable AI", async () => {
    const { rows, client } = database();
    mocks.answer.mockResolvedValueOnce({ text: '{"order":["invented"]}', model: "test", tier: "free" });
    await schedulePortfolioReview(client, "u", "cas");
    await finish();
    expect(rows.portfolio_reviews[0].state).toBe("unavailable");
    expect(rows.portfolio_reviews[0].result).toMatchObject({ ai: false });
    expect(rows.portfolio_reviews[0].baseline).toBeNull();
    expect(rows.ai_requests.find(r => r.feature === "portfolio_review")?.ok).toBe(false);
  });
  it("counts failed attempts and enforces the daily limit", async () => {
    const { rows, client } = database();
    mocks.settings.mockReturnValue({ dailyLimit: 1 });
    rows.ai_requests.push({ user_id: "u", feature: "portfolio_review_attempt" });
    await schedulePortfolioReview(client, "u", "cas");
    await finish();
    expect(mocks.answer).not.toHaveBeenCalled();
    expect(rows.portfolio_reviews[0].state).toBe("limited");
  });
});
