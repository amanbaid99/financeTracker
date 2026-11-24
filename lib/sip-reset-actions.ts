"use server";
import { requireUser } from "./data";
import { revalidatePath } from "next/cache";
export async function resetSipPlan(confirmation: unknown) {
  if (confirmation !== "RESET_SIP_PLAN") return {ok:false as const,error:"Confirm that you want to reset this SIP plan."};
  const {supabase}=await requireUser();
  const {error}=await supabase.rpc("reset_monthly_planning",{p_reset_budget:false});
  if(error)return {ok:false as const,error:"Could not reset your SIP plan. Your saved plan is unchanged. Try again."};
  revalidatePath("/","layout");
  return {ok:true as const};
}
