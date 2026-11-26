import {beforeEach,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:vi.fn(()=>{throw Error("redirect");})}));
vi.mock("@/lib/supabase/server",()=>({createClient:vi.fn()}));
vi.mock("@/lib/hybrid-data",()=>({loadHybridContext:vi.fn()}));
import {createClient} from "@/lib/supabase/server";
import {loadHybridContext} from "@/lib/hybrid-data";
import {loadBudget,loadMoneyPlan} from "@/lib/data";
import {confirmHybridPlan} from "@/lib/hybrid-actions";
import {composeGuidedBudget} from "@/lib/budget-guide";
import {todayIST} from "@/lib/dates";
const today=todayIST(),rev="a".repeat(32),loanId="00000000-0000-4000-8000-000000000001";
const sheet=composeGuidedBudget(170000,[{id:"rent",name:"Rent",category:"fixed",mode:"amount",value:58015,loanId:null},{id:"emi",name:"EMI",category:"fixed",mode:"amount",value:10000,loanId}], [{id:loanId,name:"Loan",emi:10000}],61985);
const rpc=vi.fn();
beforeEach(()=>{
 vi.clearAllMocks();
 const snapshot={goals:[],holdings:[],allocations:[],goal_bills:[],loans:[{id:loanId,name:"Loan",type:"personal",card_id:null,principal:50000,taken_on:null,rate:0,emi:10000,months_left:5,total_emis:5,emi_day:10,bill_day:null,first_emi:null,outstanding:50000,outstanding_as_of:today,balance_confirmed_on:today,foreclosure_pct:0,foreclosure_gst:false}],loan_payments:[],incomes:[],expenses:[],profile:null};
 rpc.mockImplementation(async(name:string)=>name==="app_snapshot"?{data:snapshot,error:null}:{data:"saved",error:null});
 vi.mocked(createClient).mockResolvedValue({auth:{getClaims:async()=>({data:{claims:{sub:"owner"}}})},rpc,from:(table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:table==="budget_ratio_plans"?{plan:sheet}:{plan_sip_minimums:{}},error:null})})})})} as never);
 vi.mocked(loadHybridContext).mockResolvedValue({plans:[],goalSettings:[],holdingDetails:[],revision:rev,sourceRevision:rev,riskTolerance:null} as never);
});
it("actual budget loading uses the guided budget when old income records are empty",async()=>{
 const b=await loadBudget();expect(b.recordIncome).toBe(0);expect(b.budget).toMatchObject({income:170000,costs:98015,emis:10000,planMonthly:61985});
});
it("confirmation accepts the displayed savings instead of rejecting against obsolete records",async()=>{
 expect(await confirmHybridPlan({calculatedOn:today,revision:rev,monthly:61985,lump:0,minimums:{},overrides:{}})).toEqual({ok:true});
 const call=rpc.mock.calls.find(c=>c[0]==="confirm_hybrid_plan");expect(call).toBeDefined();expect(call![1].p_inputs.monthlySavings).toBe(61985);
 expect((await confirmHybridPlan({calculatedOn:today,revision:rev,monthly:61986,lump:0,minimums:{},overrides:{}})).ok).toBe(false);
});

it("reopening a confirmed manual plan keeps its declared capacity when no budget exists",async()=>{
 const snapshot={goals:[],holdings:[],allocations:[],goal_bills:[],loans:[],loan_payments:[],incomes:[],expenses:[],profile:{plan_monthly:20000,plan_lump_sum:0}};
 vi.mocked(createClient).mockResolvedValue({auth:{getClaims:async()=>({data:{claims:{sub:"owner"}}})},rpc:async()=>({data:snapshot,error:null}),from:(table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:table==="budget_ratio_plans"?null:{plan_sip_minimums:{}},error:null})})})})} as never);
 vi.mocked(loadHybridContext).mockResolvedValue({plans:[{inputs:{budgetSource:"manual",declaredMonthlySavings:50000,monthlySavings:50000}}],goalSettings:[],holdingDetails:[],revision:rev,sourceRevision:rev,riskTolerance:null} as never);
 const p=await loadMoneyPlan();expect(p.budget.income).toBe(0);expect(p.plan!.hybrid!.availableMonthlySavings).toBe(50000);expect(p.plan!.hybrid!.monthlyPlanLimit).toBe(20000);
});
it("retains standalone SIP capacity even when a saved budget has a lower surplus",async()=>{
 const snapshot={goals:[],holdings:[],allocations:[],goal_bills:[],loans:[],loan_payments:[],incomes:[],expenses:[],profile:{plan_monthly:71000,plan_lump_sum:0}};
 vi.mocked(createClient).mockResolvedValue({auth:{getClaims:async()=>({data:{claims:{sub:"owner"}}})},rpc:async()=>({data:snapshot,error:null}),from:(table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:table==="budget_ratio_plans"?{plan:sheet}:{plan_sip_minimums:{}},error:null})})})})} as never);
 vi.mocked(loadHybridContext).mockResolvedValue({plans:[{inputs:{budgetSource:"standalone",declaredMonthlySavings:71000,monthlySavings:71000,allocationMode:"safety_deadline",monthlyEssentials:0}}],goalSettings:[],holdingDetails:[],revision:rev,sourceRevision:rev,riskTolerance:null} as never);
 const p=await loadMoneyPlan();expect(p.plan!.hybrid!.availableMonthlySavings).toBe(71000);expect(p.plan!.hybrid!.monthlyPlanLimit).toBe(71000);
});

it("excludes draft monthly SIPs from an older confirmed projection and restores them when included",async()=>{
 const snapshot={goals:[],holdings:[],allocations:[],goal_bills:[],loans:[],loan_payments:[],incomes:[],expenses:[],profile:{plan_monthly:71000,plan_lump_sum:0}};
 let included=false;
 const savedRows=[{id:"draft",goalId:null,investmentId:null,label:"Draft contribution",amount:71000}];
 vi.mocked(createClient).mockResolvedValue({auth:{getClaims:async()=>({data:{claims:{sub:"owner"}}})},rpc:async()=>({data:snapshot,error:null}),from:(table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:table==="budget_ratio_plans"?{plan:{...sheet,sipsIncluded:included,sips:savedRows}}:{plan_sip_minimums:{}},error:null})})})})} as never);
 vi.mocked(loadHybridContext).mockResolvedValue({plans:[{inputs:{budgetSource:"standalone",declaredMonthlySavings:71000,monthlySavings:71000}}],goalSettings:[],holdingDetails:[],revision:rev,sourceRevision:rev,riskTolerance:null} as never);
 const draft=await loadMoneyPlan();expect(draft.sipsIncluded).toBe(false);expect(draft.plan!.hybrid!.monthlyPlanLimit).toBe(0);expect(draft.plan!.hybrid!.availableMonthlySavings).toBe(0);
 included=true;
 const active=await loadMoneyPlan();expect(active.sipsIncluded).toBe(true);expect(active.plan!.hybrid!.monthlyPlanLimit).toBe(71000);
 expect(savedRows[0].amount).toBe(71000);expect(snapshot.holdings).toEqual([]);
});
