"use server";
import {z} from "zod";
import {requireUser} from "./data";
import {sipMinimumsSchema} from "./sip-minimums";
const schema=z.object({monthly:z.number().int().positive().max(1e9),lump:z.number().int().min(0).max(1e13),minimums:sipMinimumsSchema});
/** Cached clients must review the new planner, never bypass confirmed history. */
export async function saveSipPlan(input:z.input<typeof schema>):Promise<{ok:true}|{ok:false;error:string}>{
 if(!schema.safeParse(input).success)return {ok:false,error:"Check the monthly amounts."};
 await requireUser();
 return {ok:false,error:"The planner has been updated. Reload to review and confirm your plan. No changes were saved."};
}
