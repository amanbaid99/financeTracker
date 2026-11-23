"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "./data";

/** One explicit edit. The database preserves other goals and rolls back failures. */
export async function saveGoalMapping(input: {
  goalId: string;
  rows: { investmentId: string; percent: number }[];
}): Promise<{ok:true}|{ok:false;error:string}> {
  const parsed = z.object({goalId:z.string().uuid(),rows:z.array(z.object({
    investmentId:z.string().uuid(),percent:z.number().gt(0).max(100),
  })).max(50)}).safeParse(input);
  if(!parsed.success)return {ok:false,error:"Check the shares and try again."};
  const {supabase}=await requireUser();
  const {error}=await supabase.rpc("save_goal_coverage",{p_goal:parsed.data.goalId,p_rows:parsed.data.rows});
  if(error)return {ok:false,error:"Could not save. Some money may already cover another goal. Lower the share or refresh and try again. Your previous coverage is unchanged."};
  revalidatePath("/", "layout");
  return {ok:true};
}
