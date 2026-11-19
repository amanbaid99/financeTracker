import { beforeEach, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data", () => ({ requireUser: vi.fn() }));
import { requireUser } from "@/lib/data";
import { saveRatioPlan } from "@/lib/budget-ratio-actions";
import { defaultRatioPlan } from "@/lib/budget-ratios";
const upsert = vi.fn();
const from = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); upsert.mockResolvedValue({ error: null });
  from.mockReturnValue({ upsert });
  vi.mocked(requireUser).mockResolvedValue({ user: { id: "owner" }, supabase: { from } } as never);
});
it("validates totals before auth or writes", async () => {
  expect((await saveRatioPlan(defaultRatioPlan(0))).ok).toBe(false);
  expect(requireUser).not.toHaveBeenCalled();
});
it("saves only the signed-in owner's plan and leaves income and SIP records alone", async () => {
  const plan = defaultRatioPlan(100000);
  expect(await saveRatioPlan({ ...plan, user_id: "other" })).toEqual({ ok: true });
  expect(from).toHaveBeenCalledTimes(1);
  expect(from).toHaveBeenCalledWith("budget_ratio_plans");
  expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: "owner", plan });
});
it("rejects links to missing or other-owner goals before saving", async () => {
  const plan = defaultRatioPlan(100000);
  plan.buckets[0].children = [{ id: "child", label: "Goal", percent: 100, goalId: "00000000-0000-4000-8000-000000000001" }];
  const filter = vi.fn().mockReturnThis();
  from.mockReturnValue({ select: filter, eq: filter, in: vi.fn().mockResolvedValue({ data: [], error: null }) });
  expect((await saveRatioPlan(plan)).ok).toBe(false);
  expect(filter).toHaveBeenCalledWith("user_id", "owner");
  expect(upsert).not.toHaveBeenCalled();
});
it("reports a failed database write", async () => {
  upsert.mockResolvedValue({ error: { message: "offline" } });
  expect((await saveRatioPlan(defaultRatioPlan(100000))).ok).toBe(false);
});

it("validates ownership of explicitly selected loans before saving", async () => {
  const plan = { ...defaultRatioPlan(100000), includedEmiIds: ["00000000-0000-4000-8000-000000000090"] };
  const filter = vi.fn().mockReturnThis();
  from.mockReturnValue({ select: filter, eq: filter, in: vi.fn().mockResolvedValue({ data: [], error: null }) });
  expect((await saveRatioPlan(plan)).ok).toBe(false);
  expect(from).toHaveBeenCalledWith("loans");
  expect(filter).toHaveBeenCalledWith("user_id", "owner");
  expect(upsert).not.toHaveBeenCalled();
});
