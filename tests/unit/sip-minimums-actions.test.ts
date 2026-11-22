import { beforeEach,it,expect,vi } from "vitest";
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/data",()=>({requireUser:vi.fn(),loadGoals:vi.fn()}));
import { requireUser,loadGoals } from "@/lib/data";
import { saveSipPlan } from "@/lib/sip-minimums-actions";
const update=vi.fn(),eq=vi.fn(),select=vi.fn(),single=vi.fn(),from=vi.fn();
beforeEach(()=>{vi.clearAllMocks();const chain={eq,select,single};eq.mockReturnValue(chain);select.mockReturnValue(chain);update.mockReturnValue(chain);single.mockResolvedValue({data:{user_id:"owner"},error:null});from.mockReturnValue({update});vi.mocked(requireUser).mockResolvedValue({user:{id:"owner"},supabase:{from}} as never);vi.mocked(loadGoals).mockResolvedValue({investments:[{id:"nps",kind:"nps",monthlySip:0}]} as never);});
it("saves preferences with plan amounts only under the signed-in owner",async()=>{expect(await saveSipPlan({monthly:10000,lump:0,minimums:{"inv:nps":500}})).toEqual({ok:true});expect(update).toHaveBeenCalledWith({plan_monthly:10000,plan_lump_sum:0,plan_sip_minimums:{"inv:nps":500}});expect(eq).toHaveBeenCalledWith("user_id","owner");expect(from.mock.calls).toEqual([["profiles"]]);});
it("blocks invalid, unheld and unaffordable choices before writing",async()=>{expect((await saveSipPlan({monthly:1000,lump:0,minimums:{"inv:nps":1500}})).ok).toBe(false);expect((await saveSipPlan({monthly:1000,lump:0,minimums:{"inv:stock":500}})).ok).toBe(false);expect((await saveSipPlan({monthly:1000,lump:0,minimums:{"inv:nps":-1}})).ok).toBe(false);expect(update).not.toHaveBeenCalled();});
it("requires a successful confirmed row update",async()=>{single.mockResolvedValue({data:null,error:null});expect((await saveSipPlan({monthly:10000,lump:0,minimums:{"inv:nps":500}})).ok).toBe(false);});

it("discards removed category minimums when saving",async()=>{expect(await saveSipPlan({monthly:10000,lump:0,minimums:{mutual_fund:5000,stock:1000,nps:500,gold:1000,"inv:nps":250}})).toEqual({ok:true});expect(update).toHaveBeenCalledWith({plan_monthly:10000,plan_lump_sum:0,plan_sip_minimums:{"inv:nps":250}});});
