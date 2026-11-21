"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { loadGoals,requireUser } from "./data";
import { heldSipTypes,minimumsFit,sipMinimumsSchema } from "./sip-minimums";
const schema=z.object({monthly:z.number().int().positive().max(1e9),lump:z.number().int().min(0).max(1e13),minimums:sipMinimumsSchema});
export async function saveSipPlan(input:z.input<typeof schema>):Promise<{ok:true}|{ok:false;error:string}>{
 const parsed=schema.safeParse(input);if(!parsed.success)return {ok:false,error:"Check the monthly amounts. Use positive whole rupees, or zero for no minimum."};
 const {supabase,user}=await requireUser();const {investments}=await loadGoals();const held=new Set<string>(heldSipTypes(investments).map(t=>t.kind));
 if(Object.entries(parsed.data.minimums).some(([kind,value])=>value!>0&&!held.has(kind)))return {ok:false,error:"A chosen investment type is no longer in your portfolio. Refresh and review the plan."};
 if(!minimumsFit(parsed.data.monthly,parsed.data.minimums,investments))return {ok:false,error:"Your minimums and existing SIPs exceed the monthly budget. Reduce a minimum or increase the budget."};
 const {error,data}=await supabase.from("profiles").update({plan_monthly:parsed.data.monthly,plan_lump_sum:parsed.data.lump,plan_sip_minimums:parsed.data.minimums}).eq("user_id",user.id).select("user_id").single();
 if(error||!data)return {ok:false,error:"Could not save your SIP plan. Your choices are still here."};
 revalidatePath("/","layout");return {ok:true};
}
