import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/portfolio-review/service", () => ({ schedulePortfolioReview: vi.fn() }));
import { createClient } from "@/lib/supabase/server";
import { buildReview, type ParsedStatement } from "@/lib/statement/review";
import { applyImport } from "@/lib/statement/actions";
import { priceUpdates } from "@/lib/prices";
const id = "00000000-0000-4000-8000-000000000001";
const isin = "INF000000001";
const holding = { id, isin, name: "Synthetic fund", kind: "mutual_fund", category: "equity_index", value: 1000, units: 10, monthlySip: 0, returnPct: null };
const statement = (units = 0): ParsedStatement => ({ source: "CAMS", detailed: true, statementDate: "2026-11-18", warnings: [], holdings: [{ key: isin, isin, name: holding.name, kind: "mutual_fund", units, nav: 100, value: 0, invested: 0, navDate: "2026-11-18", sipMonthly: null, lastSipDate: null, issues: [] }] });
const update = vi.fn();
const eq = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  const chain = { eq, select: vi.fn(), single: vi.fn().mockResolvedValue({ data: { id }, error: null }) };
  update.mockReturnValue(chain);eq.mockReturnValue(chain);chain.select.mockReturnValue(chain);
  vi.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "synthetic-owner" } } }) },
    from: (table: string) => table === "holdings" ? { update } : table === "goal_allocations"
      ? { select: async () => ({ data: [], error: null }) } : { upsert: async () => ({ error: null }) },
  } as never);
});
describe("redeemed CAS positions", () => {
  it("preserves zero through review and owner-scoped save, so a later price update cannot restore value", async () => {
    const row = buildReview(statement(), [holding])[0];
    expect(row.units).toBe(0);expect(row.match?.id).toBe(id);
    const result = await applyImport([{ action: "update", investmentId: id, name: row.name, isin: row.isin, kind: row.kind,
      category: row.category, value: row.value, invested: row.invested, units: row.units, sip: null, goalId: null }]);
    expect(result).toEqual({ ok: true, updated: 1, added: 0 });
    const saved = update.mock.calls[0][0];expect(saved.units).toBe(0);expect(saved.current_value).toBe(0);
    expect(eq).toHaveBeenCalledWith("user_id", "synthetic-owner");
    const nav = `Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date\n100001;${isin};-;Synthetic fund;100;18-Nov-2026`;
    expect(priceUpdates([{ ...holding, units: saved.units, value: saved.current_value }], nav).updates).toEqual([]);
  });
  it("does not offer a closed fund as a new holding, or treat a missing-unit positive value as zero", () => {
    expect(buildReview(statement(), [])).toEqual([]);
    const unknown = statement(); unknown.holdings[0].value = 1000;
    expect(buildReview(unknown, [holding])[0].units).toBeNull();
    const aggregate = statement(); aggregate.holdings[0] = { ...aggregate.holdings[0], key: "DEMAT-STOCKS", isin: null, kind: "stock", name: "Stocks in demat" };
    expect(buildReview(aggregate, [])[0].units).toBeNull();
  });
  it("keeps unknown or invalid units distinct from an explicit zero", () => {
    for (const units of [NaN, Infinity, -1]) expect(buildReview(statement(units), [holding])[0].units).toBeNull();
    expect(buildReview(statement(2.5), [holding])[0].units).toBe(2.5);
  });
});
