import { AlertTriangle, Bell, CheckCircle2, Circle, CircleDashed, CircleMinus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AiExplain } from "@/components/ai-explain";
import { NextFocusCard } from "@/components/next-focus-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { aiConfigured } from "@/lib/ai/config";
import { loadAnalysis } from "@/lib/data";
import type { StepStatus } from "@/lib/engine/ladder";
import { formatINR, formatINRCompact } from "@/lib/format";
import { STATUS_BADGE } from "@/lib/labels";
import { buildReminders } from "@/lib/reminders";

export const metadata: Metadata = { title: "Home" };


const STEP_ICON: Record<StepStatus, React.ReactNode> = {
  done: <CheckCircle2 className="size-5 text-success" aria-label="Done" />,
  todo: <Circle className="size-5 text-primary" aria-label="To do" />,
  unknown: <CircleDashed className="size-5 text-muted-foreground" aria-label="Needs info" />,
  not_needed: <CircleMinus className="size-5 text-muted-foreground" aria-label="Not needed" />,
};

export default async function DashboardPage() {
  const { raw, data, analysis, today } = await loadAnalysis();
  const { budget, ladder, goals, completeness, nextFocus } = analysis;
  const aiOn = raw.profile.ai_enabled && aiConfigured();
  const reminders = buildReminders({
    todayISO: today,
    insurance: data.insurance,
    nextAdvanceTaxDate: budget.freelancer?.nextAdvanceTaxDate ?? null,
  });
  const allocatedPct = new Map<string, number>();
  for (const a of data.allocations) allocatedPct.set(a.holdingId, (allocatedPct.get(a.holdingId) ?? 0) + a.percent);
  const unassigned = data.holdings.reduce(
    (s, h) => s + (h.currentValue * Math.max(0, 100 - (allocatedPct.get(h.id) ?? 0))) / 100,
    0,
  );
  const base = Math.max(1, budget.baseIncome);
  const currentId = nextFocus?.step.id;

  return (
    <main className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Hi {raw.profile.name.split(" ")[0] || "there"}, here&apos;s where your next rupee should go.
      </p>

      {!budget.cashFlowOk && (
        <div role="alert" className="flex gap-3 rounded-xl border border-danger/40 bg-danger-soft p-3 text-sm text-danger">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <p>
            Your essentials and EMIs ({formatINR(budget.essentials.total)}) are more than your base income (
            {formatINR(budget.baseIncome)}). Fixing this comes first.
          </p>
        </div>
      )}

      <NextFocusCard focus={nextFocus} aiOn={aiOn} />

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your priority ladder</CardTitle>
            <CardDescription>Each step unlocks the next. We re-check it every time your data changes.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {ladder.map((s) => (
                <li
                  key={s.key}
                  className={`flex items-center gap-3 rounded-lg p-2 text-sm ${s.id === currentId ? "bg-primary-soft" : ""}`}
                >
                  {STEP_ICON[s.status]}
                  <span className="flex-1">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.status === "done"
                      ? "Done"
                      : s.status === "not_needed"
                        ? "Not needed"
                        : s.status === "unknown"
                          ? "Needs info"
                          : s.gap > 0
                            ? `${formatINRCompact(s.gap)} to go`
                            : "To do"}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Profile completeness</CardTitle>
                <span className="tabular text-sm font-semibold">{completeness.score}%</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={completeness.score} label="Profile completeness" />
              {completeness.topMissing.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {completeness.topMissing.map((m) => (
                    <li key={m.key}>
                      <Link
                        href={`/onboarding/${m.key === "risk" ? "risk" : m.key}`}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {m.label}
                      </Link>
                      <span className="text-muted-foreground"> {m.why}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{completeness.reason}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>This month</CardTitle>
                <Link href="/budget" className="text-sm text-primary underline-offset-2 hover:underline">
                  Budget
                </Link>
              </div>
              <CardDescription>Base income {formatINR(budget.baseIncome)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                <div className="rounded-l-full bg-series-1" style={{ width: `${(budget.split.essentials / base) * 100}%` }} />
                <div className="bg-series-2" style={{ width: `${(budget.split.savings / base) * 100}%` }} />
                <div className="rounded-r-full bg-series-3" style={{ width: `${(budget.split.wants / base) * 100}%` }} />
              </div>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-series-1" aria-hidden />Essentials</dt>
                  <dd className="tabular font-medium">{formatINRCompact(budget.split.essentials)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-series-2" aria-hidden />Save</dt>
                  <dd className="tabular font-medium">{formatINRCompact(budget.split.savings)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-series-3" aria-hidden />Wants</dt>
                  <dd className="tabular font-medium">{formatINRCompact(budget.split.wants)}</dd>
                </div>
              </dl>
              {budget.essentials.estimated && (
                <p className="text-xs text-muted-foreground">Essentials are estimated until you add expenses.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Goals</CardTitle>
              <Link href="/goals" className="text-sm text-primary underline-offset-2 hover:underline">
                All goals
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No goals yet.{" "}
                <Link href="/goals/new?type=retirement" className="text-primary underline">
                  Start with retirement
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-3">
                {goals.slice(0, 4).map((g) => (
                  <li key={g.goalId}>
                    <Link href={`/goals/${g.goalId}`} className="block space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{g.name}</span>
                        <Badge variant={STATUS_BADGE[g.status].variant}>{STATUS_BADGE[g.status].label}</Badge>
                      </div>
                      <Progress
                        value={g.futureTarget ? (g.currentAmount / g.futureTarget) * 100 : 100}
                        tone={g.status === "behind" ? "danger" : g.status === "slightly_behind" ? "warning" : "success"}
                        label={`${g.name} progress`}
                      />
                      <p className="tabular text-xs text-muted-foreground">
                        {formatINRCompact(g.currentAmount)} of {formatINRCompact(g.futureTarget)}
                        {g.requiredMonthly > 0 ? ` · needs ${formatINR(g.requiredMonthly)}/month` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-4" aria-hidden /> Reminders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {reminders.length === 0 && unassigned < 1 && (
              <p className="text-muted-foreground">Nothing due right now.</p>
            )}
            {reminders.map((r) => (
              <Link key={r.id} href={r.href} className="block rounded-lg bg-warning-soft p-3 text-warning">
                {r.text}
              </Link>
            ))}
            {unassigned >= 1 && (
              <Link href="/holdings" className="block rounded-lg bg-muted p-3">
                <span className="font-medium">{formatINRCompact(unassigned)} unassigned.</span>{" "}
                <span className="text-muted-foreground">Map your holdings to goals so they count.</span>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {aiOn && (
        <Card>
          <CardHeader>
            <CardTitle>Plan review</CardTitle>
            <CardDescription>
              A short AI review of your whole plan, written from your computed numbers only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AiExplain feature="plan_review" label="Review my plan" />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
