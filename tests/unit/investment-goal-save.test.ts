import {beforeEach,expect,it,vi} from "vitest";
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/headers",()=>({cookies:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:vi.fn()}));
vi.mock("@/lib/portfolio-review/service",()=>({schedulePortfolioReview:vi.fn()}));
import {createClient} from "@/lib/supabase/server";
import {saveInvestment} from "@/lib/actions";
const goalId="00000000-0000-4000-8000-000000000001",holdingId="00000000-0000-4000-8000-000000000002";
const allocationInsert=vi.fn(),allocationUpdate=vi.fn(),holdingInsert=vi.fn(),holdingUpdate=vi.fn();
const allocationChain={eq:vi.fn().mockReturnThis(),select:vi.fn()};
const holdingChain={eq:vi.fn().mockReturnThis(),select:vi.fn().mockReturnThis(),single:vi.fn()};
beforeEach(()=>{
 vi.clearAllMocks();allocationChain.select.mockResolvedValue({data:[],error:null});allocationInsert.mockResolvedValue({error:null});allocationUpdate.mockReturnValue(allocationChain);holdingInsert.mockReturnValue(holdingChain);holdingUpdate.mockReturnValue(holdingChain);holdingChain.single.mockResolvedValue({data:{id:holdingId},error:null});
 const read={eq:vi.fn().mockResolvedValue({data:[],error:null})};
 vi.mocked(createClient).mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:"owner"}}})},from:(table:string)=>table==="holdings"?{insert:holdingInsert,update:holdingUpdate}:{select:()=>read,insert:allocationInsert,update:allocationUpdate}} as never);
});
const input={goalId,investmentId:null,kind:"savings" as const,fundCategory:null,name:"Travel savings",value:10000,monthlySip:0,returnPct:null,percent:100};
it("saves a newly added investment and its parent goal link in the same action",async()=>{
 expect(await saveInvestment(input)).toEqual({ok:true,id:holdingId});
 expect(holdingInsert).toHaveBeenCalledOnce();
 expect(allocationInsert).toHaveBeenCalledWith({user_id:"owner",goal_id:goalId,holding_id:holdingId,percent:100});
});
it("updates a shared investment link in place without adding another allocation",async()=>{
 allocationChain.select.mockResolvedValue({data:[{id:"allocation"}],error:null});
 expect((await saveInvestment({...input,investmentId:holdingId,percent:35})).ok).toBe(true);
 expect(allocationUpdate).toHaveBeenCalledWith({percent:35});
 expect(allocationChain.eq).toHaveBeenCalledWith("goal_id",goalId);
 expect(allocationChain.eq).toHaveBeenCalledWith("holding_id",holdingId);
 expect(allocationChain.eq).toHaveBeenCalledWith("user_id","owner");
 expect(allocationInsert).not.toHaveBeenCalled();
});
it("surfaces a failed link instead of reporting that the goal investment saved",async()=>{
 allocationInsert.mockResolvedValue({error:{message:"Link could not be saved"}});
 expect(await saveInvestment(input)).toEqual({ok:false,error:"Link could not be saved"});
});
