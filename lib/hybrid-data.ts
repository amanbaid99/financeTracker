import "server-only";
import { cache } from "react";
import { requireUser } from "./data";
export const loadHybridContext = cache(async () => {
  const { supabase, user } = await requireUser();
  const [plans, goalSettings, holdingDetails, revision, sourceRevision, risk] =
    await Promise.all([
      supabase
        .from("allocation_plans")
        .select("id,created_at,engine_version,input_revision,inputs,result")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1),
      supabase
        .from("goals")
        .select("id,planning_settings,status,priority")
        .eq("user_id", user.id),
      supabase
        .from("holdings")
        .select("id,planning_details")
        .eq("user_id", user.id),
      supabase.rpc("hybrid_input_revision"),
      supabase.rpc("hybrid_source_revision"),
      supabase
        .from("profiles")
        .select("risk_profile")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
  if (
    plans.error ||
    goalSettings.error ||
    holdingDetails.error ||
    revision.error ||
    sourceRevision.error ||
    risk.error
  )
    throw Error("Could not load your plan settings. Reload before planning.");
  return {
    plans: plans.data ?? [],
    goalSettings: goalSettings.data ?? [],
    holdingDetails: holdingDetails.data ?? [],
    revision: revision.data!,
    sourceRevision: sourceRevision.data!,
    riskTolerance: risk.data?.risk_profile ?? null,
  };
});

/** History is needed only on Your plan, not on every portfolio/home request. */
export const loadHybridHistory=cache(async()=>{
 const {supabase,user}=await requireUser();
 const {data,error}=await supabase.from("allocation_plans").select("id,created_at,result").eq("user_id",user.id).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(10);
 if(error)throw Error("Could not load your previous plans. Try again.");
 return data??[];
});

/** Budget displays the confirmed SIP snapshot, never a fresh recommendation. */
export const loadSavedSipPlan = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("allocation_plans")
    .select("id,created_at,result")
    .eq("user_id", user.id)
    .eq("inputs->>allocationMode", "safety_deadline")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1).maybeSingle();
  if (error) throw Error("Could not load your saved SIP plan.");
  return data;
});
