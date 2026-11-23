"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { loadGoals, loadBudget, requireUser } from "./data";
import { loadHybridContext } from "./hybrid-data";
import { hybridPlan, hybridVehicles } from "./hybrid-plan";
import { proposeGoalMapping } from "./hybrid-mapping";
import { monthlyCapacity, unallocatedLiquidValue } from "./hybrid-engine";
import { sipMinimumsSchema } from "./sip-minimums";
import type { Json } from "./supabase/database.types";
const schema = z.object({
  calculatedOn:z.iso.date(),
  revision: z.string().regex(/^[a-f0-9]{32}$/),
  monthly: z.number().int().min(0).max(1e9),
  lump: z.number().int().min(0).max(1e13),
  cashBuffer: z.number().int().min(0).max(1e9).default(0),
  refreshMapping: z.boolean().default(false),
  minimums: sipMinimumsSchema,
  overrides: z
    .record(z.string().uuid(), z.number().int().min(0).max(1e9))
    .default({}),
});
export async function confirmHybridPlan(
  input: z.input<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const v = schema.parse(input),
      { supabase } = await requireUser();
    const [g, b, c] = await Promise.all([
      loadGoals(),
      loadBudget(),
      loadHybridContext(),
    ]);
    if(g.today!==v.calculatedOn)return {ok:false,error:"The calculation date changed. Refresh and review the plan before confirming."};
    if (c.revision !== v.revision)
      return {
        ok: false,
        error:
          "Your goals, budget or balances changed. Reload and review the updated recommendation.",
      };
    const capacity = monthlyCapacity(
      b.budget.income,
      b.budget.costs,
      b.budget.emis,
      v.cashBuffer,
    );
    if (v.monthly > capacity.availableSavings)
      return {
        ok: false,
        error:
          "This plan exceeds your available monthly savings. Update your budget or lower the plan amount.",
      };
    const held = new Set(g.investments.map((i) => `inv:${i.id}`));
    if (Object.keys(v.minimums).some((k) => !held.has(k)))
      return {
        ok: false,
        error: "A chosen holding no longer exists. Reload the plan.",
      };
    if (Object.values(v.minimums).reduce((s, n) => s + n, 0) > v.monthly)
      return {
        ok: false,
        error: "Your holding minimums exceed this monthly plan.",
      };
    const links = proposeGoalMapping(
      g.goals,
      g.investments,
      c.plans.length ? g.links : [],
      g.today,
      { refresh: v.refreshMapping, riskTolerance: c.riskTolerance },
    );
    const spare = unallocatedLiquidValue(g.investments, links, g.today);
    if (v.lump > spare)
      return {
        ok: false,
        error:
          "The one-time amount exceeds unallocated recorded investments. Lower it to avoid counting money twice.",
      };
    const inputs = {
      sourceRevision: c.sourceRevision,
      riskTolerance: c.riskTolerance,
      refreshMapping: v.refreshMapping,
      today: g.today,
      goals: g.goals,
      investments: g.investments,
      links,
      monthlySavings: capacity.availableSavings,
      monthlyPlanLimit: v.monthly,
      budgetDeficit: capacity.budgetDeficit,
      oneTime: v.lump,
      minimums: v.minimums,
      overrides: v.overrides,
      cashBuffer: v.cashBuffer,
      budget: b.budget,
    };
    const result = hybridPlan(inputs);
    result.vehicles = hybridVehicles(inputs, result);
    const { error } = await supabase.rpc("confirm_hybrid_plan", {
      p_revision: v.revision,
      p_inputs: JSON.parse(JSON.stringify(inputs)) as Json,
      p_result: JSON.parse(JSON.stringify(result)) as Json,
      p_links: links as unknown as Json,
      p_monthly: v.monthly,
      p_lump: v.lump,
      p_minimums: v.minimums,
    });
    if (error)
      return {
        ok: false,
        error:
          "Could not confirm the plan. Your inputs may have changed. Reload and review before trying again.",
      };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof z.ZodError
          ? "Check the monthly amounts and reload the plan."
          : error instanceof Error
            ? error.message
            : "Could not save your plan. Your choices are still here.",
    };
  }
}
