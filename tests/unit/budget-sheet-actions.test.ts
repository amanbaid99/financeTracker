import { beforeEach, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data", () => ({ requireUser: vi.fn() }));
import { requireUser } from "@/lib/data";
import { resetBudgetSheet, saveBudgetSheet } from "@/lib/budget-ratio-actions";
import { emptyBudgetSheet } from "@/lib/budget-sheet";
const rpc=vi.fn();
const upsert = vi.fn(), from = vi.fn();
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({error:null});upsert.mockResolvedValue({ error: null }); from.mockReturnValue({ upsert }); vi.mocked(requireUser).mockResolvedValue({ user: { id: "owner" }, supabase: { from,rpc } } as never); });
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

it("requires explicit reset confirmation before authentication or deletion", async () => {
  for (const value of [null, undefined, "", "yes", { user_id: "other" }]) expect((await resetBudgetSheet(value)).ok).toBe(false);
  expect(requireUser).not.toHaveBeenCalled(); expect(from).not.toHaveBeenCalled();
});
it("resets Budget and SIP planning in one authenticated operation",async()=>{
 expect(await resetBudgetSheet("RESET_BUDGET")).toEqual({ok:true});expect(rpc).toHaveBeenCalledWith("reset_monthly_planning",{p_reset_budget:true});expect(from).not.toHaveBeenCalled();
});
it("reports reset failure without partially resetting Budget",async()=>{
 rpc.mockResolvedValue({error:{message:"offline"}});expect((await resetBudgetSheet("RESET_BUDGET")).ok).toBe(false);expect(from).not.toHaveBeenCalled();
});

it("normalises rules on the server rather than trusting a stale free-spending row", async () => {
  const plan = { ...emptyBudgetSheet(100000), rules: { savings: { mode: "percent", value: 20 }, investing: { mode: "amount", value: 30000 } }, rows: [] };
  expect((await saveBudgetSheet(plan)).ok).toBe(true);
  const saved = upsert.mock.calls[0][0].plan;
  expect(saved.rows.map((r: { value: number }) => r.value)).toEqual([20000, 30000, 50000]);
  expect(saved.rules).toEqual(plan.rules);
});
it("rejects named allocations above a target before writing", async () => {
  const plan = { ...emptyBudgetSheet(100000), rules: { savings: { mode: "percent", value: 10 }, investing: { mode: "amount", value: 0 } }, rows: [{ id: "saving", name: "Emergency", category: "savings", mode: "amount", value: 20000, loanId: null }] };
  expect((await saveBudgetSheet(plan)).ok).toBe(false); expect(upsert).not.toHaveBeenCalled();
});

it("persists a combined target without splitting or duplicating existing allocations", async () => {
 const plan={...emptyBudgetSheet(100000),standalone:true,rules:{savings:{mode:"amount",value:0},investing:{mode:"amount",value:0},future:{mode:"amount",value:40000}},rows:[{id:"existing",name:"Existing monthly investment",category:"investing",mode:"amount",value:15000,loanId:null}]};
 expect((await saveBudgetSheet(plan)).ok).toBe(true);
 const saved=upsert.mock.calls[0][0].plan;
 expect(saved.rules.future).toEqual({mode:"amount",value:40000});expect(saved.rows.map((r:{value:number})=>r.value)).toEqual([15000,25000,60000]);
});
