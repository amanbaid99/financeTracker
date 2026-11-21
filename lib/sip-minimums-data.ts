import "server-only";
import { cache } from "react";
import { requireUser } from "./data";
import { readSipMinimums } from "./sip-minimums";
export const loadSipMinimums=cache(async()=>{
 const {supabase,user}=await requireUser();
 const {data,error}=await supabase.from("profiles").select("plan_sip_minimums").eq("user_id",user.id).maybeSingle();
 if(error)throw new Error("Could not load your monthly investment choices. Try again.");
 return readSipMinimums(data?.plan_sip_minimums);
});
