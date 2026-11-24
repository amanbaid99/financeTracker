import {beforeEach,expect,it,vi} from "vitest";
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));vi.mock("@/lib/data",()=>({requireUser:vi.fn()}));
import {requireUser} from "@/lib/data";import {resetSipPlan} from "@/lib/sip-reset-actions";
const rpc=vi.fn();beforeEach(()=>{vi.clearAllMocks();rpc.mockResolvedValue({error:null});vi.mocked(requireUser).mockResolvedValue({supabase:{rpc}} as never);});
it("requires confirmation and resets only monthly planning",async()=>{expect((await resetSipPlan("yes")).ok).toBe(false);expect(requireUser).not.toHaveBeenCalled();expect(await resetSipPlan("RESET_SIP_PLAN")).toEqual({ok:true});expect(rpc).toHaveBeenCalledWith("reset_monthly_planning",{p_reset_budget:false});});
it("reports reset failure without claiming success",async()=>{rpc.mockResolvedValue({error:{message:"offline"}});expect((await resetSipPlan("RESET_SIP_PLAN")).ok).toBe(false);});
