import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { focusGoals, nextMilestone } from "@/lib/home";
import { formatINR } from "@/lib/format";
import { goalStatus } from "@/lib/goal-status";
import { milestoneLabel } from "@/lib/milestone-label";
import type { TrackedGoal } from "@/lib/tracker";
import type { Card } from "@/lib/cards";
import type { Loan } from "@/lib/loans";

export function HomeOverview({ goals, cards, loans, today, between = false }: {
  goals: TrackedGoal[]; cards: Card[]; loans: Loan[]; today: string; between?: boolean;
}) {
  const focus = focusGoals(goals, today);
  const milestone = nextMilestone(cards, loans, today);
  return <>
    <section aria-labelledby="home-goals" data-guide="home-focus" className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
        <h2 id="home-goals" className="font-semibold">Focus goals</h2>
        <Link href="/goals" className="inline-flex min-h-10 items-center text-sm text-primary">View all</Link>
      </div>
      {focus.length ? <ul className="divide-y px-4">{focus.map((g) => <li key={g.id}>
        <Link href={`/goals?open=${encodeURIComponent(g.id)}`} className="block space-y-2 py-4">
          <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words font-medium">{g.name}</h3><span className="shrink-0 text-xs text-muted-foreground">{goalStatus(g, today, between).label}</span></div>
          <Progress value={g.progress * 100} label={`${g.name} progress`} />
          <p className="tabular text-sm text-muted-foreground">{formatINR(g.current)} of {formatINR(g.futureTarget)}</p>
        </Link>
      </li>)}</ul> : <p className="px-4 pb-4 text-sm text-muted-foreground">{goals.length ? "Your goals are covered. Open Goals to review them." : "Add your first goal to see it here."}</p>}
    </section>
    <section aria-labelledby="home-milestone" className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3"><h2 id="home-milestone" className="font-semibold">Next card milestone</h2><Link href="/cards" className="inline-flex min-h-10 items-center text-sm text-primary">Cards</Link></div>
      {milestone ? <Link href={`/cards?open=${encodeURIComponent(milestone.card.id)}`} className="block space-y-2">
        <p className="text-xs text-muted-foreground">{milestone.card.label}</p>
        <h3 className="break-words font-medium">{milestoneLabel(milestone.state)}</h3>
        <Progress value={milestone.state.progress * 100} label={`${milestone.card.label} milestone progress`} />
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="tabular">{formatINR(milestone.state.remaining)} to go</span>{milestone.state.end && <span className="text-muted-foreground">By {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(milestone.state.end))}</span>}</div>
        <p className="tabular text-xs text-muted-foreground">{formatINR(milestone.state.spentNow)} of {formatINR(milestone.state.target)} eligible spending logged</p>
      </Link> : <p className="text-sm text-muted-foreground">{cards.length ? "No unfinished milestones. View your cards for details." : "Add a card and milestone in Cards to track it here."}</p>}
    </section>
  </>;
}
