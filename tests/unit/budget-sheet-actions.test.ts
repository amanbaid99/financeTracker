import { beforeEach, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data", () => ({ requireUser: vi.fn() }));
import { requireUser } from "@/lib/data";
import { saveBudgetSheet } from "@/lib/budget-ratio-actions";
import { emptyBudgetSheet } from "@/lib/budget-sheet";
const upsert = vi.fn(), from = vi.fn();
beforeEach(() => { vi.clearAllMocks(); upsert.mockResolvedValue({ error: null }); from.mockReturnValue({ upsert }); vi.mocked(requireUser).mockResolvedValue({ user: { id: "owner" }, supabase: { from } } as never); });
it("validates before accessing data", async () => { expect((await saveBudgetSheet(emptyBudgetSheet(0))).ok).toBe(false); expect(requireUser).not.toHaveBeenCalled(); });
it("saves only the owner's sheet without writing income, investments or loans", async () => {
  const plan = emptyBudgetSheet(100000);
  expect(await saveBudgetSheet({ ...plan, user_id: "other" })).toEqual({ ok: true });
  expect(from).toHaveBeenCalledTimes(1); expect(from).toHaveBeenCalledWith("budget_ratio_plans"); expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: "owner", plan });
});
it("checks ownership of automatic loan rows before saving", async () => {
  const plan = { ...emptyBudgetSheet(100000), rows: [{ id: "loan", name: "EMI", category: "fixed", mode: "amount", value: 1000, loanId: "00000000-0000-4000-8000-000000000090" }] };
  const filter = vi.fn().mockReturnThis(); from.mockReturnValue({ select: filter, eq: filter, in: vi.fn().mockResolvedValue({ data: [], error: null }) });
  expect((await saveBudgetSheet(plan)).ok).toBe(false); expect(filter).toHaveBeenCalledWith("user_id", "owner"); expect(upsert).not.toHaveBeenCalled();
});
