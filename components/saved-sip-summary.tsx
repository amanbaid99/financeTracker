import Link from "next/link";
import { ArrowUpRight, Repeat2 } from "lucide-react";
import type { HybridResult } from "@/lib/hybrid-engine";
import { formatINR } from "@/lib/format";

/** Read only: amounts come from the last confirmed plan, not actual deposits. */
export function SavedSipSummary({ result }: { result: HybridResult }) {
  const goals = [...result.goals].filter(g => g.recommendedMonthly > 0).sort((a,b) =>
    (result.fundingOrder?.indexOf(a.goalId) ?? 0) - (result.fundingOrder?.indexOf(b.goalId) ?? 0));
  return <section aria-label="Saved SIP plan" className="surface-card overflow-hidden rounded-3xl border border-primary/20 bg-card">
    <div className="bg-primary/5 p-5">
      <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm text-primary"><Repeat2 className="size-4" aria-hidden />Monthly SIP plan</p>
      <Link href="/goals/sip" className="flex min-h-10 shrink-0 items-center gap-1 rounded-full border bg-card px-3 text-sm text-primary">Edit plan<ArrowUpRight className="size-4" aria-hidden /></Link>
      </div>
        <p className="tabular mt-2 break-words text-3xl font-semibold tracking-tight">{formatINR(result.totalMonthlyAllocated)}<span className="ml-1 text-sm font-normal text-muted-foreground">/ month</span></p>
        <p className="mt-1 text-xs text-muted-foreground">Your saved allocation</p>

    </div>
    <div className="divide-y px-5">
      {goals.map(g => <div key={g.goalId} className="py-4">
        <div className="flex items-start justify-between gap-3 text-sm font-semibold"><h3 className="min-w-0 break-words">{g.goalName}</h3><span className="tabular shrink-0">{formatINR(g.recommendedMonthly)}</span></div>
        <ul className="mt-2 space-y-2">{(result.vehicles ?? []).flatMap(v => v.parts.filter(p=>p.goalId===g.goalId && p.monthly>0).map((p,n)=><li key={`${v.key}:${n}`} className="flex items-start justify-between gap-4 text-xs text-muted-foreground"><span className="min-w-0 break-words">{v.label}</span><span className="tabular shrink-0">{formatINR(p.monthly)}</span></li>))}</ul>
      </div>)}
      {!goals.length && <p className="py-4 text-sm text-muted-foreground">No monthly contributions in this plan. Edit it whenever you’re ready.</p>}
    </div>
    <p className="border-t px-5 py-3 text-xs text-muted-foreground">Planned amounts only. Set up SIPs with your provider.</p>
  </section>;
}
