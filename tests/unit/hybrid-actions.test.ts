import { beforeEach, it, expect, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data", () => ({
  requireUser: vi.fn(),
  loadGoals: vi.fn(),
  loadBudget: vi.fn(),
}));
vi.mock("@/lib/hybrid-data", () => ({ loadHybridContext: vi.fn() }));
import { requireUser, loadGoals, loadBudget } from "@/lib/data";
import { loadHybridContext } from "@/lib/hybrid-data";
import { confirmHybridPlan } from "@/lib/hybrid-actions";
const rpc = vi.fn(),
  rev = "a".repeat(32),
  source = "b".repeat(32);
const input = {
  calculatedOn:"2026-11-22",
  revision: rev,
  monthly: 10000,
  lump: 0,
  minimums: {},
  overrides: {},
};
beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ error: null, data: "saved" });
  vi.mocked(requireUser).mockResolvedValue({
    user: { id: "owner" },
    supabase: { rpc },
  } as never);
  vi.mocked(loadGoals).mockResolvedValue({
    today: "2026-11-22",
    goals: [],
    investments: [],
    links: [],
  } as never);
  vi.mocked(loadBudget).mockResolvedValue({
    budget: { income: 100000, costs: 40000, emis: 10000 },
  } as never);
  vi.mocked(loadHybridContext).mockResolvedValue({
    revision: rev,
    sourceRevision: source,
    plans: [],
  } as never);
});
it("recomputes and saves one atomic snapshot, without updating holdings", async () => {
  expect(await confirmHybridPlan(input)).toEqual({ ok: true });
  expect(rpc).toHaveBeenCalledOnce();
  const [name, args] = rpc.mock.calls[0];
  expect(name).toBe("confirm_hybrid_plan");
  expect(args.p_result.strategy).toBe("hybrid");
  expect(args.p_inputs.sourceRevision).toBe(source);
  expect(args.p_result.totalMonthlyAllocated).toBe(0);
});
it("rejects stale previews before confirming", async () => {
  expect(
    (await confirmHybridPlan({ ...input, revision: "c".repeat(32) })).ok,
  ).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
it("caps plans by the real budget and extra buffer", async () => {
  expect((await confirmHybridPlan({ ...input, monthly: 50001 })).ok).toBe(
    false,
  );
  expect(
    (await confirmHybridPlan({ ...input, monthly: 40000, cashBuffer: 20000 }))
      .ok,
  ).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
it("rejects foreign holding keys and duplicate one-time money", async () => {
  expect(
    (await confirmHybridPlan({ ...input, minimums: { "inv:foreign": 500 } }))
      .ok,
  ).toBe(false);
  expect((await confirmHybridPlan({ ...input, lump: 10000 })).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
it("supports zero surplus without inventing contributions", async () => {
  vi.mocked(loadBudget).mockResolvedValue({
    budget: { income: 0, costs: 1000, emis: 500 },
  } as never);
  expect(await confirmHybridPlan({ ...input, monthly: 0 })).toEqual({
    ok: true,
  });
  expect(rpc.mock.calls[0][1].p_result.budgetDeficit).toBe(1500);
});
it("keeps a failed RPC from being reported as confirmed", async () => {
  rpc.mockResolvedValue({ error: { message: "changed" } });
  expect((await confirmHybridPlan(input)).ok).toBe(false);
});

it("requires a fresh review when the calculation date changes",async()=>{expect((await confirmHybridPlan({...input,calculatedOn:"2026-11-21"})).ok).toBe(false);expect(rpc).not.toHaveBeenCalled();});
