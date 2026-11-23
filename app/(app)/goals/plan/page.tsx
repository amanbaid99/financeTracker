import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { InvestmentVehicles } from "@/components/investment-vehicles";
import { buttonVariants } from "@/components/ui/button";
import { loadHybridContext, loadHybridHistory } from "@/lib/hybrid-data";
import { HYBRID_VERSION } from "@/lib/hybrid-engine";
import { snapshotCompatible } from "@/lib/hybrid-plan";
import { sameGoalMapping } from "@/lib/hybrid-mapping";
import { loadMoneyPlan } from "@/lib/data";
import { formatINR, formatDate } from "@/lib/format";
import { todayIST } from "@/lib/dates";

export const metadata: Metadata = {title:"Your monthly plan"};
const STATUS={fully_funded:"Fully funded",on_track:"On track",at_risk:"At risk",underfunded:"Underfunded"};
export default async function PlanPage(){
 const [d,c,history]=await Promise.all([loadMoneyPlan(),loadHybridContext(),loadHybridHistory()]);
 const latest=c.plans[0];
 const result=latest&&snapshotCompatible(latest.result)?latest.result:null;
 const stale=!!result&&(latest.input_revision!==c.sourceRevision||result.calculatedOn!==d.today||latest.engine_version!==HYBRID_VERSION||!sameGoalMapping(result.links,d.links));
 return <main className="space-y-4">
  <BackLink fallback="/goals" label="Goals"/>
  <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Your monthly plan</h1>
   <Link href="/goals/sip" className={buttonVariants({variant:"outline",size:"sm"})}>{result?"Edit plan":"Create plan"}</Link>
  </div>
  {result?<>
   <section className="surface-card space-y-4 rounded-2xl border bg-card p-4">
    <div><p className="text-xs text-muted-foreground">Your confirmed plan</p><p className="tabular text-3xl font-semibold">{formatINR(result.totalMonthlyAllocated)}</p></div>
    {stale&&<p className="rounded-xl bg-muted/50 p-3 text-sm">Your inputs changed. Edit the plan to review updated amounts. This saved plan stays unchanged until you confirm.</p>}
    {(result.vehicles??[]).some(v=>v.total>0)?<InvestmentVehicles rows={result.vehicles??[]}/>:<p className="text-sm text-muted-foreground">No monthly contributions in this plan. Your existing investments still cover your goals.</p>}
    {result.monthlyContributionShortfall>0&&<p className="text-sm text-muted-foreground">Your goals need about {formatINR(result.monthlyContributionShortfall)} more a month. You can adjust amounts, dates or targets.</p>}
    <p className="text-xs text-muted-foreground">This is your plan in the app. Set up SIPs with your provider and record actual contributions separately.</p>
   </section>
   <details className="surface-card rounded-2xl border bg-card p-4"><summary className="min-h-10 cursor-pointer font-semibold">Goal coverage and calculations</summary>
    <p className="text-xs text-muted-foreground">Confirmed {formatDate(todayIST(new Date(latest.created_at)))}. Projections use the assumptions saved with this plan.</p>
    <Link href="/goals/order" className="inline-flex min-h-10 items-center text-sm text-primary">Change essential order</Link>
    <ul className="divide-y">{result.goals.map(g=><li key={g.goalId} className="space-y-1 py-3 text-sm">
     <p className="font-medium">{g.goalName} · {STATUS[g.status]}</p>
     <p>Existing coverage {formatINR(g.existingCoverage)} · Planned {formatINR(g.recommendedMonthly)}/mo</p>
     <p>Needs {formatINR(g.requiredMonthly)}/mo · Monthly gap {formatINR(g.monthlyShortfall)}</p>
     <p>Projected {formatINR(g.projectedCorpus)} of {formatINR(g.targetCorpus)}</p>
     <p className="text-xs text-muted-foreground">{g.explanation}</p>
     <p className="text-xs text-muted-foreground">Return {g.assumptions.annualReturnPct}% · Inflation {g.assumptions.inflationPct}% · Contributions at month end.</p>
     {g.warnings.map((w,i)=><p key={i} className="text-xs text-warning">{w}</p>)}
    </li>)}</ul>
    {result.warnings.map((w,i)=><p key={i} className="py-1 text-xs text-warning">{w}</p>)}
   </details>
  </>:<p className="rounded-2xl border bg-card p-4 text-sm">Create a monthly plan to see where to put your savings. Your budget sets the available amount.</p>}
  <Link href="/assets/withdraw" className="inline-flex min-h-11 items-center text-sm text-primary">Plan a withdrawal</Link>
  {history.length>1&&<details className="surface-card rounded-2xl border bg-card p-4"><summary className="min-h-10 cursor-pointer text-sm font-semibold">Previous plans</summary><ul className="divide-y">{history.slice(1).filter(p=>snapshotCompatible(p.result)).map(p=>{const r=p.result as NonNullable<typeof result>;return <li key={p.id} className="py-3 text-sm"><details><summary className="min-h-10 cursor-pointer">{formatDate(todayIST(new Date(p.created_at)))} · {formatINR(r.totalMonthlyAllocated)}/mo</summary><InvestmentVehicles rows={r.vehicles??[]}/></details></li>;})}</ul></details>}
 </main>;
}
