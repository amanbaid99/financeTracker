import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { loadAnalysis } from "@/lib/data";
import { sortGoalsForFunding } from "@/lib/engine/goals";
import { formatINR, formatINRCompact, formatMonths, goalWhen } from "@/lib/format";
import { GOAL_TYPE_LABELS, STATUS_BADGE } from "@/lib/labels";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const { analysis } = await loadAnalysis();
  const goals = sortGoalsForFunding(analysis.goals);
  const onGoalStep = !analysis.nextFocus || analysis.nextFocus.step.key === "goals";

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
          <p className="text-sm text-muted-foreground">Funded by priority, then by nearest date.</p>
        </div>
        <Link href="/goals/new" className={buttonVariants()}>
          <Plus /> New goal
        </Link>
      </div>
      {!onGoalStep && analysis.nextFocus && (
        <p className="rounded-lg bg-muted p-3 text-sm">
          New savings go to <span className="font-medium">{analysis.nextFocus.title.toLowerCase()}</span> first. Keep
          existing SIPs running; goals get new money once the earlier steps are done.
        </p>
      )}
      {goals.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 pt-5 sm:pt-5">
            <p className="text-sm text-muted-foreground">No goals yet. Retirement is a good first one.</p>
            <Link href="/goals/new?type=retirement" className={buttonVariants({ variant: "outline" })}>
              Add retirement
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => (
            <li key={g.goalId}>
              <Link href={`/goals/${g.goalId}`} className="block h-full">
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardContent className="space-y-3 pt-4 sm:pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{g.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {GOAL_TYPE_LABELS[g.type]} · priority {g.priority} · {goalWhen(g)}
                        </p>
                      </div>
                      <Badge variant={STATUS_BADGE[g.status].variant}>{STATUS_BADGE[g.status].label}</Badge>
                    </div>
                    <Progress
                      value={g.futureTarget ? (g.currentAmount / g.futureTarget) * 100 : 100}
                      tone={g.status === "behind" ? "danger" : g.status === "slightly_behind" ? "warning" : "success"}
                      label={`${g.name} progress`}
                    />
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Target then</dt>
                        <dd className="tabular font-medium">{formatINRCompact(g.futureTarget)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          {g.openEnded ? "Get there in" : "Needs monthly"}
                        </dt>
                        <dd className="tabular font-medium">
                          {g.openEnded
                            ? g.estimatedMonths === null
                              ? "Not at this pace"
                              : formatMonths(g.estimatedMonths)
                            : g.requiredMonthly > 0
                              ? formatINR(g.requiredMonthly)
                              : "Nothing more"}
                        </dd>
                      </div>
                    </dl>
                    {g.glidePath && (
                      <Badge variant="warning">Start moving this goal to debt</Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
