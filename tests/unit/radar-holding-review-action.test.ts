import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/radar/data", () => ({ requireRadar: vi.fn(), loadRadar: vi.fn(), radarInstruments: vi.fn(), radarProvider: vi.fn(), radarFinancialProvider: vi.fn() }));
import { requireRadar, loadRadar } from "@/lib/radar/data";
import { saveRadarHoldingReview } from "@/lib/radar/actions";
const id = "00000000-0000-4000-8000-000000000001";
const review = { ownershipConfirmed: true, contextConfirmed: true, costsReviewed: true, targetSharePct: 10, rebalanceBandPct: 2, thesis: "intact", estimatedExitCostPct: 1 };
const update = vi.fn(), eq = vi.fn(), single = vi.fn();
const chain = { update, eq, select: vi.fn(), single };
beforeEach(() => {
  vi.clearAllMocks();update.mockReturnValue(chain);eq.mockReturnValue(chain);chain.select.mockReturnValue(chain);single.mockResolvedValue({ error: null });
  vi.mocked(requireRadar).mockResolvedValue({ user: { id: "synthetic-owner" }, supabase: { from: () => chain } } as never);
  vi.mocked(loadRadar).mockResolvedValue({ items: [{ id, isin: "INE000000001", ownedInTracker: true, classification: { kind: "stock", needsReview: false } }], history: [] } as never);
});
describe("holding review server action", () => {
  it("authenticates, derives identity/time on the server and scopes the write to its owner", async () => {
    expect((await saveRadarHoldingReview(id, review)).ok).toBe(true);
    expect(requireRadar).toHaveBeenCalledOnce();
    const saved = update.mock.calls[0][0].holding_review;
    expect(saved.isin).toBe("INE000000001");expect(Number.isFinite(Date.parse(saved.reviewedAt))).toBe(true);
    expect(saved.recordedSharePct).toBeUndefined();
    expect(eq).toHaveBeenCalledWith("id", id);expect(eq).toHaveBeenCalledWith("user_id", "synthetic-owner");
  });
  it("clears the review only through an owner-scoped explicit action", async () => {
    expect((await saveRadarHoldingReview(id, null)).ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ holding_review: null });expect(eq).toHaveBeenCalledWith("user_id", "synthetic-owner");
  });
  it.each([{ ...review, reviewedAt: "2026-01-01T00:00:00Z" }, { ...review, targetSharePct: 101 }, { ...review, contextConfirmed: false }])("rejects invalid client context without writes", async (value) => {
    expect((await saveRadarHoldingReview(id, value)).ok).toBe(false);expect(update).not.toHaveBeenCalled();
  });
  it("requires a current confirmed stock holding", async () => {
    for (const item of [undefined, { id, isin: "INE000000001", ownedInTracker: false, classification: { kind: "stock", needsReview: false } }, { id, isin: "INE000000001", ownedInTracker: true, classification: { kind: "etf", needsReview: false } }]) {
      vi.mocked(loadRadar).mockResolvedValue({ items: item ? [item] : [], history: [] } as never);
      expect((await saveRadarHoldingReview(id, review)).ok).toBe(false);
    }
    expect(update).not.toHaveBeenCalled();
  });
  it("does not hide a database save failure or bypass Radar access", async () => {
    single.mockResolvedValue({ error: { code: "42501" } });
    expect((await saveRadarHoldingReview(id, review)).ok).toBe(false);
    vi.mocked(requireRadar).mockRejectedValue(new Error("Access denied"));
    await expect(saveRadarHoldingReview(id, review)).rejects.toThrow("Access denied");
  });
});
