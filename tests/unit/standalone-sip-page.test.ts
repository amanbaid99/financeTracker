import {expect,it,vi,beforeEach} from "vitest";
vi.mock("@/lib/data",()=>({loadGoals:vi.fn(),loadBudget:vi.fn()}));
vi.mock("@/lib/budget-ratio-data",()=>({loadBudgetSheet:vi.fn()}));
vi.mock("@/lib/hybrid-data",()=>({loadHybridContext:vi.fn()}));
vi.mock("@/lib/hybrid-actions",()=>({confirmHybridPlan:vi.fn()}));
import {loadGoals,loadBudget} from "@/lib/data";
import {loadBudgetSheet} from "@/lib/budget-ratio-data";
import {loadHybridContext} from "@/lib/hybrid-data";
import SipPage from "@/app/(app)/goals/sip/page";
import {SimpleSipPlanner} from "@/components/simple-sip-planner";
beforeEach(()=>{
 vi.mocked(loadGoals).mockResolvedValue({today:"2026-11-24",goals:[],investments:[],links:[],plan:{monthly:1000,lump:0}} as never);
 vi.mocked(loadHybridContext).mockResolvedValue({plans:[{inputs:{contributionStartMonth:"2027-01",budgetSource:"standalone",monthlySavings:71000,monthlyPlanLimit:71000}}],revision:"a".repeat(32),riskTolerance:null} as never);
 vi.mocked(loadBudget).mockResolvedValue({budget:{income:200000},recordIncome:200000,loanEmis:[]} as never);
 vi.mocked(loadBudgetSheet).mockResolvedValue({plan:{version:2,salary:200000,rows:[],excludedLoanIds:[]},saved:false,error:null});
});
const planner=async()=>{const page=await SipPage();return page.props.children.find((child:{type:unknown})=>child.type===SimpleSipPlanner);};
it("preserves a manual saved amount when no budget exists",async()=>{
 const p=await planner();expect(p.props.initialMonthly).toBe(71000);expect(p.props.initialStartMonth).toBe("2027-01");expect(p.props).not.toHaveProperty("monthlyEssentials");
});
it("starts from 91985 in Save and invest instead of the older 71000 plan",async()=>{
 vi.mocked(loadBudgetSheet).mockResolvedValue({saved:true,error:null,plan:{version:2,salary:200000,rows:[{id:"save",name:"Save",category:"savings",mode:"amount",value:91985,loanId:null}],excludedLoanIds:[]}});
 const p=await planner();expect(p.props.initialMonthly).toBe(91985);expect(p.props.budgetMonthly).toBe(91985);expect(p.props.initialStartMonth).toBe("2027-01");
});
it("a budget load failure does not block manual SIP planning",async()=>{
 vi.mocked(loadBudget).mockRejectedValue(Error("offline"));expect((await planner()).props.initialMonthly).toBe(71000);
});
it("does not resurrect the old profile amount after an explicit reset",async()=>{
 vi.mocked(loadHybridContext).mockResolvedValue({sipReset:true,plans:[],revision:"a".repeat(32),riskTolerance:null} as never);
 vi.mocked(loadGoals).mockResolvedValue({today:"2026-11-24",goals:[],investments:[],links:[],plan:{monthly:71000,lump:0}} as never);
 const p=await planner();expect(p.props.initialMonthly).toBeNull();expect(p.props.initialOverrides).toEqual({});expect(p.props.initialVehicleOverrides).toEqual({});
});
