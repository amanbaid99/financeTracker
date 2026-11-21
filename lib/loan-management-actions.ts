"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "./data";
import { todayIST } from "./dates";
const inputSchema=z.object({id:z.string().uuid(),confirmation:z.enum(["CLOSE_LOAN","DELETE_LOAN"])});

/** Explicit owner-confirmed closure or removal, accessible without a payoff goal. */
export async function manageLoan(input:unknown){
 const parsed=inputSchema.safeParse(input);
 if(!parsed.success)return {ok:false as const,error:"Confirm the loan action before continuing."};
 const {supabase,user}=await requireUser();
 const {id,confirmation}=parsed.data;
 if(confirmation==="DELETE_LOAN"){
  const linked=await supabase.from("goals").select("id").eq("user_id",user.id).eq("loan_id",id).limit(1);
  if(linked.error)return {ok:false as const,error:"Could not check the payoff goal. Try again."};
  if(linked.data?.length)return {ok:false as const,error:"This loan still has a payoff goal. Mark it closed to keep that history, or delete the payoff goal before permanently removing the loan."};
 }
 const today=todayIST();
 const query=confirmation==="CLOSE_LOAN"?supabase.from("loans").update({outstanding:0,outstanding_as_of:today,balance_confirmed_on:today}):supabase.from("loans").delete();
 const result=await query.eq("id",id).eq("user_id",user.id).select("id").single();
 if(result.error)return {ok:false as const,error:"Could not update this loan. It may have changed; reload and try again."};
 revalidatePath("/","layout");
 return {ok:true as const};
}
