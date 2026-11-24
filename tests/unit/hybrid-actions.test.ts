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
it("rejects plans above available savings", async () => {
  expect((await confirmHybridPlan({ ...input, monthly: 50001 })).ok).toBe(false);
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
    budgetConfigured:true,
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

it("allows a declared monthly capacity without a saved budget, without inventing income",async()=>{
 vi.mocked(loadBudget).mockResolvedValue({budgetConfigured:false,budget:{income:0,costs:1000,emis:0}} as never);
 expect(await confirmHybridPlan({...input,monthly:20000,manualSavings:25000})).toEqual({ok:true});
 const inputs=rpc.mock.calls[0][1].p_inputs;expect(inputs.monthlySavings).toBe(25000);expect(inputs.budget.income).toBe(0);expect(inputs.budgetSource).toBe("manual");
 expect((await confirmHybridPlan({...input,monthly:26000,manualSavings:25000})).ok).toBe(false);
});
it("a manual declaration cannot bypass a saved budget's available amount",async()=>{
 vi.mocked(loadBudget).mockResolvedValue({budgetConfigured:true,budget:{income:10000,costs:10000,emis:0}} as never);
 expect((await confirmHybridPlan({...input,monthly:10000,manualSavings:10000})).ok).toBe(false);expect(rpc).not.toHaveBeenCalled();
});

it("persists exact choices separately from the full monthly allowance",async()=>{
 vi.mocked(loadGoals).mockResolvedValue({today:"2026-11-22",goals:[],links:[],investments:[{id:"holding",name:"Retirement account",kind:"nps",category:null,value:10000,monthlySip:0,returnPct:0}]} as never);
 expect(await confirmHybridPlan({...input,exactHoldings:true,minimums:{"inv:holding":1000}})).toEqual({ok:true});
 const args=rpc.mock.calls[0][1];
 expect(args.p_inputs.exactHoldings).toBe(true);
 expect(args.p_monthly).toBe(10000);
 expect(args.p_minimums).toEqual({"inv:holding":1000});
 expect(args.p_result.vehicles).toEqual(expect.arrayContaining([expect.objectContaining({key:"inv:holding",total:1000})]));
});
it("rejects exact holding choices above the monthly allowance",async()=>{
 vi.mocked(loadGoals).mockResolvedValue({today:"2026-11-22",goals:[],links:[],investments:[{id:"holding",name:"Retirement account",kind:"nps",value:0,monthlySip:0}]} as never);
 expect((await confirmHybridPlan({...input,exactHoldings:true,minimums:{"inv:holding":10001}})).ok).toBe(false);
 expect(rpc).not.toHaveBeenCalled();
});

it("confirms standalone goal-first amounts without reading the budget",async()=>{
 expect((await confirmHybridPlan({...input,allocationMode:"safety_deadline",monthlyEssentials:1})).ok).toBe(true);
 const args=rpc.mock.calls[0][1];expect(args.p_inputs.monthlyEssentials).toBe(0);expect(loadBudget).not.toHaveBeenCalled();expect(args.p_inputs.budgetSource).toBe("standalone");expect(args.p_result.allocationMode).toBe("safety_deadline");
});
it("allows independent emergency planning without mandatory expense inputs",async()=>{
 vi.mocked(loadBudget).mockResolvedValue({budgetConfigured:false,budget:{income:0,costs:0,emis:0}} as never);
 vi.mocked(loadGoals).mockResolvedValue({today:input.calculatedOn,goals:[{id:"safety",name:"Safety",type:"emergency_fund",target:120000,targetDate:null,inflationPct:0}],investments:[],links:[]} as never);
 expect((await confirmHybridPlan({...input,manualSavings:10000,allocationMode:"safety_deadline"})).ok).toBe(true);expect(loadBudget).not.toHaveBeenCalled();
 expect((await confirmHybridPlan({...input,manualSavings:10000,allocationMode:"safety_deadline",monthlyEssentials:10000})).ok).toBe(true);
 expect(rpc.mock.calls[1][1].p_inputs.monthlyEssentials).toBe(0);
});
it("accepts explicit zero essential costs without pretending a missing value was zero",async()=>{
 vi.mocked(loadBudget).mockResolvedValue({budgetConfigured:false,budget:{income:0,costs:0,emis:0}} as never);
 vi.mocked(loadGoals).mockResolvedValue({today:input.calculatedOn,goals:[{id:"safety",name:"Safety",type:"emergency_fund",target:120000,targetDate:null,inflationPct:0}],investments:[],links:[]} as never);
 expect((await confirmHybridPlan({...input,manualSavings:10000,allocationMode:"safety_deadline",monthlyEssentials:0})).ok).toBe(true);
 expect(rpc.mock.calls[0][1].p_inputs.monthlyEssentials).toBe(0);
});
it("saves 71000 independently even if Budget is zero or cannot be read",async()=>{
 vi.mocked(loadBudget).mockRejectedValue(new Error("Budget must not be queried"));
 expect(await confirmHybridPlan({...input,monthly:71000,allocationMode:"safety_deadline"})).toEqual({ok:true});
 expect(loadBudget).not.toHaveBeenCalled();const args=rpc.mock.calls[0][1];expect(args.p_monthly).toBe(71000);expect(args.p_inputs.monthlySavings).toBe(71000);expect(args.p_inputs.budgetSource).toBe("standalone");expect(args.p_inputs.budget).toBeNull();
});
it("confirms scoped vehicle choices and recomputes totals on the server",async()=>{
 const goalId="00000000-0000-4000-8000-000000000001";
 vi.mocked(loadGoals).mockResolvedValue({today:input.calculatedOn,goals:[{id:goalId,name:"Safety",type:"emergency_fund",target:120000,targetDate:"2027-11-22",inflationPct:0,expectedReturnPct:0}],investments:[{id:"holding",name:"Savings",kind:"mutual_fund",category:"liquid_fund",value:10000,monthlySip:0,returnPct:0}],links:[{goalId,investmentId:"holding",percent:100}]} as never);
 const vehicleOverrides={[goalId]:{"inv:holding":2000}};
 expect(await confirmHybridPlan({...input,allocationMode:"safety_deadline",overrides:{[goalId]:3000},vehicleOverrides})).toEqual({ok:true});
 const args=rpc.mock.calls[0][1];expect(args.p_inputs.vehicleOverrides).toEqual(vehicleOverrides);expect(args.p_result.vehicles.reduce((n:number,v:{total:number})=>n+v.total,0)).toBe(3000);expect(args.p_result.vehicles.find((v:{key:string})=>v.key==="inv:holding").total).toBe(2000);expect(args.p_result.goals[0].existingCoverage).toBe(10000);
});
it("rejects vehicle choices for an unknown goal before writing",async()=>{
 expect((await confirmHybridPlan({...input,allocationMode:"safety_deadline",vehicleOverrides:{"00000000-0000-4000-8000-000000000001":{"inv:foreign":1000}}})).ok).toBe(false);expect(rpc).not.toHaveBeenCalled();
});
it("persists and recomputes the standalone SIP start month without reading Budget",async()=>{
 const res=await confirmHybridPlan({...input,allocationMode:"safety_deadline",contributionStartMonth:"2027-01"});expect(res.ok).toBe(true);expect(loadBudget).not.toHaveBeenCalled();expect(rpc.mock.calls[0][1].p_inputs.contributionStartMonth).toBe("2027-01");
});
