import Link from "next/link";
import { ChevronRight,CreditCard,Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { focusGoals, nextMilestone } from "@/lib/home";
import { formatINRCompact,formatINR } from "@/lib/format";
import { goalStatus } from "@/lib/goal-status";
import { milestoneLabel } from "@/lib/milestone-label";
import type { TrackedGoal } from "@/lib/tracker";
import type { Card } from "@/lib/cards";
import type { Loan } from "@/lib/loans";

export function HomeOverview({ goals,cards,loans,today,between=false }:{goals:TrackedGoal[];cards:Card[];loans:Loan[];today:string;between?:boolean}){
 const focus=focusGoals(goals,today),milestone=nextMilestone(cards,loans,today);
 return <>
  {focus.length>0?<section aria-labelledby="home-goals" data-guide="home-focus" className="overflow-hidden rounded-2xl border bg-card">
   <Link href="/goals" className="flex min-h-12 items-center justify-between gap-3 px-4"><h2 id="home-goals" className="text-sm font-semibold">Focus goals</h2><ChevronRight className="size-4 text-muted-foreground" aria-hidden /></Link>
   <ul className="divide-y px-4">{focus.map(g=><li key={g.id}><Link href={`/goals?open=${encodeURIComponent(g.id)}`} className="press block space-y-2 py-3">
    <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words text-sm font-medium">{g.name}</h3><span className="shrink-0 text-xs text-muted-foreground">{goalStatus(g,today,between).label}</span></div>
    <Progress value={g.progress*100} label={`${g.name} progress`} className="h-1" />
    <p className="tabular text-xs text-muted-foreground">{formatINRCompact(g.current)} of {formatINRCompact(g.futureTarget)}</p>
   </Link></li>)}</ul>
  </section>:goals.length>0?<Link href="/goals" data-guide="home-focus" className="flex min-h-12 items-center justify-between gap-3 px-1 text-sm text-muted-foreground"><span>Your goals are covered</span><ChevronRight className="size-4" aria-hidden /></Link>:<section data-guide="home-focus" className="space-y-3 rounded-2xl border bg-card p-4"><Target className="size-5 text-primary" aria-hidden /><h2 className="font-semibold">What are you saving for?</h2><p className="text-sm text-muted-foreground">Add a goal to give your money a direction.</p><Link href="/goals/new" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary">Add your first goal<ChevronRight className="size-4" aria-hidden /></Link></section>}
  {milestone&&<section aria-labelledby="home-milestone"><Link href={`/cards?open=${encodeURIComponent(milestone.card.id)}`} className="press block space-y-3 rounded-2xl border bg-card p-4">
   <div className="flex items-center gap-2 text-muted-foreground"><CreditCard className="size-4" aria-hidden /><h2 id="home-milestone" className="flex-1 text-xs font-medium">Closest card milestone</h2><ChevronRight className="size-4" aria-hidden /></div>
   <div className="flex items-start justify-between gap-3"><div className="min-w-0 space-y-1"><p className="break-words text-sm font-semibold">{milestone.card.label}</p><p className="break-words text-xs text-muted-foreground">{milestoneLabel(milestone.state)}</p></div><p className="tabular shrink-0 text-right text-sm font-semibold">{formatINR(milestone.state.remaining)}<span className="block text-xs font-normal text-muted-foreground">to go</span></p></div>
   <Progress value={milestone.state.progress*100} label={`${milestone.card.label} milestone progress`} className="h-1" />
   {milestone.state.end&&<p className="text-xs text-muted-foreground">By {new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(milestone.state.end))}</p>}
  </Link></section>}
 </>;
}
