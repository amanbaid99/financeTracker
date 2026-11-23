"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {readGoalPlanning} from "./hybrid-settings";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Your order for the money plan: goal ids, first to last. Null goes back to
 * the app's own order. Saved only when you press Save.
 */
export async function savePlanOrder(ids: string[] | null,essentialOnly=false): Promise<Result> {
  try {
    const list = ids ? z.array(z.string().uuid()).max(99).refine(items=>new Set(items).size===items.length,"Each goal can appear only once.").parse(ids) : null;
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect("/login");
    const userId = data.user.id;
    let essentialIds:string[]=[];
    if(essentialOnly){const current=await supabase.from("goals").select("id,type,planning_settings").eq("user_id",userId);if(current.error)throw current.error;essentialIds=current.data.filter(g=>(readGoalPlanning(g.planning_settings).goalCategory??(["emergency_fund","bills_fund","loan_payoff"].includes(g.type)?"essential":"flexible"))==="essential").map(g=>g.id);if(list?.some(id=>!essentialIds.includes(id)))throw Error("Goals changed. Refresh the order.");}
    const query=supabase.from("goals").update({plan_rank:null}).eq("user_id",userId);
    const clear=essentialOnly?await query.in("id",essentialIds):await query;
    if (clear.error) throw new Error(clear.error.message);
    for (const [i, id] of (list ?? []).entries()) {
      const up = await supabase
        .from("goals")
        .update({ plan_rank: i + 1 })
        .eq("id", id)
        .eq("user_id", userId);
      if (up.error) throw new Error(up.error.message);
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save the order",
    };
  }
}
