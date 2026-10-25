import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteGoalButton, EditGoalButton, GoalInvestments } from "@/components/goal-actions";
import { GoalIcon } from "@/components/goal-icon";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { loadGoals } from "@/lib/data";
import { formatDate, formatINR, formatMonths } from "@/lib/format";
import { goalHeadline, monthYear, TONE_BAR, TONE_TEXT } from "@/lib/goal-summary";
import { goalTypeInfo } from "@/lib/goal-types";
import type { TrackedGoal } from "@/lib/tracker";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Goal" };

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular text-right", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}

/** What it takes: the plain-language plan for a savings goal. */
function SavingsPlan({ g }: { g: TrackedGoal }) {
  const needed = g.monthlySip + g.extraSipNeeded;
  return (
    <dl className="divide-y">
      <Row label="Going in each month" value={formatINR(g.monthlySip)} />
      {g.targetDate ? (
        <>
          {g.projected !== null && <Row label={`Expected by ${monthYear(g.targetDate)}`} value={formatINR(g.projected)} />}
          {g.status !== "reached" && (
            <Row label="Needed each month to be on time" value={formatINR(needed)} strong={g.extraSipNeeded > 0} />
          )}
        </>
      ) : (
        g.status !== "reached" && (
          <Row
            label="You'll get there"
            value={
              g.monthsToReach === null
                ? "Not at this pace"
                : `${monthYear(g.reachDate)} (${formatMonths(g.monthsToReach)})`
            }
          />
        )
      )}
      {g.lines.length > 0 && <Row label="Expected growth" value={`about ${g.returnPct}% a year`} />}
    </dl>
  );
}

function LoanPlan({ g }: { g: TrackedGoal }) {
  const l = g.loanState!;
  const needed = g.monthlySip + g.extraSipNeeded;
  let plan: React.ReactNode;
  if (g.status === "reached") {
    plan = `You've saved enough to close it today. Paying it off now saves about ${formatINR(l.interestLeft)} in interest.`;
  } else if (g.emisCloseFirst && g.targetDate) {
    plan = `Your EMIs close this loan in ${monthYear(l.endDate)}, before your date. No extra saving needed.`;
  } else if (g.targetDate) {
    plan = (
      <>
        On {formatDate(g.targetDate)} you&apos;ll still owe <b>{formatINR(g.futureTarget)}</b>. Put{" "}
        <b>{formatINR(needed)} a month</b> into your investments to close it then
        {g.interestSaved > 0 ? <>, and save about <b>{formatINR(g.interestSaved)}</b> in interest</> : null}.
      </>
    );
  } else if (g.monthsToReach !== null) {
    plan = (
      <>
        At {formatINR(g.monthlySip)} a month, your savings catch up with what you owe around{" "}
        <b>{monthYear(g.reachDate)}</b>. Closing it then saves about <b>{formatINR(g.interestSaved)}</b> in interest.
      </>
    );
  } else {
    plan = g.monthlySip
      ? `At this pace your EMIs close it first, in ${monthYear(l.endDate)}. Save more each month to close it sooner.`
      : "Add an investment or a SIP to see when you could close it early.";
  }

  return (
    <div className="space-y-3">
      <dl className="divide-y">
        <Row label="Owed today" value={formatINR(l.balance)} strong />
        <Row label="EMI" value={`${formatINR(l.emi)} at ${l.ratePct}%`} />
        <Row label="This month: interest" value={formatINR(l.interestThisMonth)} />
        <Row label="This month: principal" value={formatINR(l.principalThisMonth)} />
        <Row
          label="Closes on its own"
          value={l.monthsLeft === null ? "Never at this EMI" : `${monthYear(l.endDate)} (${l.monthsLeft} EMIs)`}
        />
        {l.interestLeft !== null && <Row label="Interest still to pay" value={formatINR(l.interestLeft)} />}
      </dl>
      <p className="rounded-lg bg-muted p-3 text-sm">{plan}</p>
    </div>
  );
}

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { goals, investments, links, today } = await loadGoals();
  const g = goals.find((x) => x.id === id);
  if (!g) notFound();
  const h = goalHeadline(g);
  const isLoan = !!g.loanState;
  const needLabel = isLoan
    ? g.targetDate && !g.emisCloseFirst
      ? `needed to close it on ${formatDate(g.targetDate)}`
      : "owed today"
    : g.targetDate
      ? `needed by ${formatDate(g.targetDate)}`
      : "needed";

  return (
    <main className="space-y-5">
      <Link href="/goals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Your goals
      </Link>

      <div className="flex items-center gap-3">
        <GoalIcon type={g.type} className="size-12" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{g.name}</h1>
          <p className="text-sm text-muted-foreground">{goalTypeInfo(g.type).label}</p>
        </div>
        <EditGoalButton goal={g} today={today} />
      </div>

      <Card>
        <CardContent className="space-y-3 pt-5 sm:pt-5">
          <p className={cn("text-lg font-semibold", TONE_TEXT[h.tone])}>{h.text}</p>
          <div>
            <p className="tabular text-3xl font-semibold tracking-tight">{formatINR(g.current)}</p>
            <p className="tabular text-sm text-muted-foreground">
              saved of {formatINR(g.emisCloseFirst ? 0 : g.futureTarget)} {needLabel}
            </p>
          </div>
          <Progress value={g.progress * 100} tone={TONE_BAR[h.tone]} label={`${g.name} progress`} />
          {!isLoan && g.futureTarget !== g.target && (
            <p className="text-xs text-muted-foreground">
              {formatINR(g.target)} today, grown at {g.inflationPct}% a year for rising prices.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-3 sm:pt-3">{isLoan ? <LoanPlan g={g} /> : <SavingsPlan g={g} />}</CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 sm:pt-5">
          <GoalInvestments goal={g} investments={investments} links={links} />
        </CardContent>
      </Card>

      <DeleteGoalButton id={g.id} />
    </main>
  );
}
