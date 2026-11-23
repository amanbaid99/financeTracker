import {sameGoalMapping} from "@/lib/hybrid-mapping";
import { ArrowUpDown, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { HybridPlanner } from "@/components/hybrid-planner";
import {loadHybridContext,loadHybridHistory} from "@/lib/hybrid-data";
import {HYBRID_VERSION} from "@/lib/hybrid-engine";
import {snapshotCompatible} from "@/lib/hybrid-plan";
import {readSipMinimums} from "@/lib/sip-minimums";
import { buttonVariants } from "@/components/ui/button";
import { loadMoneyPlan } from "@/lib/data";

export const metadata: Metadata = { title: "Your plan" };

/** How your monthly money is split across goals, in your order. */
export default async function PlanPage() {
  const [d,c,h] = await Promise.all([loadMoneyPlan(),loadHybridContext(),loadHybridHistory()]);
  const latest=c.plans[0],confirmed=latest&&snapshotCompatible(latest.result)?{createdAt:latest.created_at,result:latest.result,inputs:latest.inputs,stale:latest.input_revision!==c.sourceRevision||latest.result.calculatedOn!==d.today||latest.engine_version!==HYBRID_VERSION||!sameGoalMapping(latest.result.links,d.links)}:null;
  const prefs=latest?.inputs as {minimums?:unknown}|undefined;
  return (
    <main className="space-y-5">
      <BackLink fallback="/goals" label="Goals" />
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Your plan</h1>
          <Link
            href="/goals/order"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowUpDown /> Edit order
          </Link>
        </div>
      </div>
      {d.plan ? (
        <HybridPlanner mode="view" initialMonthly={d.budget.planMonthly} savedMonthly={d.planInput?.monthly} goals={d.goals} investments={d.investments} links={d.links} today={d.today} lump={d.planInput?.lump??0} essentialsMonthly={d.budget.costs+d.budget.emis} budgetDeficit={Math.max(0,d.budget.costs+d.budget.emis-d.budget.income)} initialMinimums={readSipMinimums(prefs?.minimums)} riskTolerance={c.riskTolerance} revision={c.revision} confirmed={confirmed} history={h.slice(1).filter(p=>snapshotCompatible(p.result)).map(p=>({id:p.id,createdAt:p.created_at,result:p.result as NonNullable<typeof confirmed>["result"]}))}/>

      ) : (
        <div className="surface-card space-y-3 rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Choose a monthly amount to split across your goals.
          </p>
          <Link
            href="/goals/sip"
            className={buttonVariants({
              variant: "default",
            })}
          >
            <Sparkles /> Create a SIP plan
          </Link>
        </div>
      )}
    </main>
  );
}
