import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/radar/data", () => ({ requireRadar: vi.fn(), loadRadar: vi.fn(), radarInstruments: vi.fn(), radarProvider: vi.fn(), radarFinancialProvider: vi.fn() }));
import { requireRadar, loadRadar, radarProvider, radarFinancialProvider } from "@/lib/radar/data";
import { refreshRadar } from "@/lib/radar/actions";
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
describe("fresh history provenance", () => {
  it("fetches prices again and records policy in the new immutable snapshot without changing an old snapshot", async () => {
    vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-18T08:00:00Z"));
    const item = { id: "00000000-0000-4000-8000-000000000001", exchange: "NSE", securityId: "123", isin: "INE000000001", assetType: "equity", priceBelow: null, drawdownPct: null, classification: { kind: "stock", needsReview: false } };
    const legacy = { watchId: item.id, fetchedAt: "2026-11-16T08:00:00Z", analysis: { inputs: { adjustmentsVerified: false } } };
    const before = JSON.stringify(legacy);
    vi.mocked(loadRadar).mockResolvedValue({ items: [item], history: [legacy] } as never);
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(requireRadar).mockResolvedValue({ user: { id: "synthetic-owner" }, supabase: { from: () => ({ insert }) } } as never);
    const history = vi.fn().mockResolvedValue([{ date: "2026-11-17", open: 100, high: 100, low: 100, close: 100, volume: 1000 }]);
    vi.mocked(radarProvider).mockReturnValue({ history, depth: async () => { throw new Error("Synthetic depth missing"); } } as never);
    vi.mocked(radarFinancialProvider).mockReturnValue(null);
    expect((await refreshRadar(item.id)).ok).toBe(true);expect(history).toHaveBeenCalledOnce();
    const saved = insert.mock.calls[0][0];
    expect(saved.analysis.inputs.historyPolicy.fetchedAt).toBe("2026-11-18T08:00:00.000Z");
    expect(saved.analysis.inputs.historyPolicy.prices).toBe("split-and-bonus-adjusted");
    expect(saved.analysis.inputs.adjustmentsVerified).toBe(false);expect(saved.analysis.technicals.averageTradedValue20).toBeNull();
    expect(saved.input_hash).toHaveLength(64);expect(JSON.stringify(legacy)).toBe(before);
  });
});
