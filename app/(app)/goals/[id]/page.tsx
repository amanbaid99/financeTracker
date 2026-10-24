import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiExplain } from "@/components/ai-explain";
import { GoalForm } from "@/components/forms/goal-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { Progress } from "@/components/ui/progress";
import { aiConfigured } from "@/lib/ai/config";
import { loadAnalysis } from "@/lib/data";
import { categoryLabel } from "@/lib/engine/categories";
import { linkedHoldings } from "@/lib/engine/goals";
import { goalState } from "@/lib/form-state";
import { formatDate, formatINR, formatINRCompact, formatMonths } from "@/lib/format";
import { HOLDING_KIND_LABELS, STATUS_BADGE } from "@/lib/labels";

export const metadata: Metadata = { title: "Goal" };

function Stat({ label, value, tip }: { label: string; value: string; tip?: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {tip && <InfoTip text={tip} />}
      </dt>
      <dd className="tabular text-lg font-semibold">{value}</dd>
    </div>
  );
}

export default async function GoalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const { raw, data, analysis, today } = await loadAnalysis();
  const row = raw.goals.find((g) => g.id === id);
  const g = analysis.goals.find((x) => x.goalId === id);
  if (!row || !g) notFound();
  const links = linkedHoldings(id, data.holdings, data.allocations);
  const aiOn = raw.profile.ai_enabled && aiConfigured();

  if (edit === "1") {
    return (
      <main className="mx-auto max-w-2xl space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight">Edit goal</h1>
        <Card>
          <CardContent className="pt-5 sm:pt-5">
            <GoalForm
              initial={goalState(row, today)}
              defaultInflation={analysis.config.goals.inflationByType}
              afterSave={`/goals/${id}`}
              cancelHref={`/goals/${id}`}
            />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{g.name}</h1>
            <Badge variant={STATUS_BADGE[g.status].variant}>{STATUS_BADGE[g.status].label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            By {formatDate(g.targetDate)} ({formatMonths(g.months)} away) · priority {g.priority}
          </p>
        </div>
        <Link href={`/goals/${id}?edit=1`} className="text-sm text-primary underline-offset-2 hover:underline">
          Edit goal
        </Link>
      </div>

      {g.glidePath && (
        <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <p>
            Start moving this goal to debt. It&apos;s under {analysis.config.goals.glidePathYears} years away, so shift
            about a third of its equity into debt-type categories each year to protect it from a late market fall.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>The plan</CardTitle>
          <CardDescription>{g.reason}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Target today" value={formatINRCompact(g.targetToday)} />
            <Stat
              label="Target then"
              value={formatINRCompact(g.futureTarget)}
              tip={`Today's amount grown by ${g.inflationPct}% inflation a year until your target date.`}
            />
            <Stat label="Saved so far" value={formatINRCompact(g.currentAmount)} />
            <Stat
              label="Invest monthly"
              value={g.dueNow ? `${formatINRCompact(g.requiredMonthly)} now` : formatINR(g.requiredMonthly)}
              tip={`Monthly SIP needed at a ${g.returnPct}% a year planning return, with what you've saved growing at the same rate.`}
            />
          </dl>
          {g.requiredMonthly > 0 && !g.dueNow && g.months >= 24 && g.requiredMonthlyStepUp < g.requiredMonthly && (
            <p className="rounded-lg bg-primary-soft p-3 text-sm">
              <span className="font-medium">Or start smaller with a step-up SIP:</span>{" "}
              {formatINR(g.requiredMonthlyStepUp)}/month now, raised by {g.stepUpPct}% every year, reaches the same
              target.
            </p>
          )}
          <div className="space-y-1">
            <Progress
              value={g.futureTarget ? (g.currentAmount / g.futureTarget) * 100 : 100}
              tone={g.status === "behind" ? "danger" : g.status === "slightly_behind" ? "warning" : "success"}
              label="Goal progress"
            />
            <p className="tabular text-xs text-muted-foreground">
              At your current SIPs ({formatINR(g.linkedSip)}/month, including any yearly step-ups) you&apos;d reach {formatINRCompact(g.projected)},{" "}
              {Math.round(g.projectedPct * 100)}% of the target.
            </p>
          </div>
          {aiOn && <AiExplain feature="goal" goalId={id} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where to keep this money</CardTitle>
          <CardDescription>
            {g.band.label} away. Suggested categories, planned at {g.returnPct}% a year. Category only, never a
            specific fund.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-wrap gap-2">
            {g.categories.map((c) => (
              <li key={c}>
                <Badge variant="default">{c}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Linked holdings</CardTitle>
            <Link href="/holdings" className="text-sm text-primary underline-offset-2 hover:underline">
              Manage
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No holdings linked. Link savings or investments on the Holdings page so they count toward this goal.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {links.map(({ holding, percent }) => (
                <li key={holding.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{holding.name || HOLDING_KIND_LABELS[holding.kind]}</p>
                    <p className="text-xs text-muted-foreground">
                      {categoryLabel(holding.category)} · {percent}% of it
                      {holding.monthlySip && holding.sipStepUpPct ? ` · SIP +${holding.sipStepUpPct}% a year` : ""}
                    </p>
                  </div>
                  <span className="tabular">{formatINR((holding.currentValue * percent) / 100)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
