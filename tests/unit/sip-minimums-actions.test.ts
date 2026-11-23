import {it,expect,vi} from "vitest";
vi.mock("@/lib/data",()=>({requireUser:vi.fn(async()=>({user:{id:"owner"},supabase:{from:vi.fn()}}))}));
import {requireUser} from "@/lib/data";
import {saveSipPlan} from "@/lib/sip-minimums-actions";
it("requires old clients to reload instead of bypassing confirmed plan history",async()=>{
 const result=await saveSipPlan({monthly:10000,lump:0,minimums:{"inv:nps":500}});expect(result.ok).toBe(false);if(!result.ok)expect(result.error).toContain("Reload");const {supabase}=await requireUser();expect(supabase.from).not.toHaveBeenCalled();
});
it("rejects malformed legacy amounts without writes",async()=>{expect((await saveSipPlan({monthly:-1,lump:0,minimums:{}})).ok).toBe(false);});
