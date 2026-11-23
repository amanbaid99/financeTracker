import {expect,it,vi} from "vitest";
vi.mock("@/lib/data",()=>({loadGoals:vi.fn(),loadBudget:vi.fn(()=>{throw Error("SIP page must not load Budget")})}));
vi.mock("@/lib/hybrid-data",()=>({loadHybridContext:vi.fn()}));
vi.mock("@/lib/hybrid-actions",()=>({confirmHybridPlan:vi.fn()}));
import {loadGoals,loadBudget} from "@/lib/data";
import {loadHybridContext} from "@/lib/hybrid-data";
import SipPage from "@/app/(app)/goals/sip/page";
import {SimpleSipPlanner} from "@/components/simple-sip-planner";
it("reopens the chosen SIP total without budget or emergency estimate options",async()=>{
 vi.mocked(loadGoals).mockResolvedValue({today:"2026-11-23",goals:[],investments:[],links:[],plan:{monthly:1000,lump:0}} as never);
 vi.mocked(loadHybridContext).mockResolvedValue({plans:[{inputs:{budgetSource:"standalone",monthlySavings:71000,monthlyPlanLimit:71000}}],revision:"a".repeat(32),riskTolerance:null} as never);
 const page=await SipPage();const planner=page.props.children.find((child:{type:unknown})=>child.type===SimpleSipPlanner);
 expect(planner.props.initialMonthly).toBe(71000);expect(planner.props).not.toHaveProperty("monthlyEssentials");expect(planner.props).not.toHaveProperty("budgetMonthly");expect(loadBudget).not.toHaveBeenCalled();
});
