// Plain-language plan for a goal: what's going in, what it needs, and for
// loans the EMI breakdown. Renders on the server or inside client components.

import { formatDate, formatINR, formatMonths } from "@/lib/format";
import { monthYear } from "@/lib/goal-summary";
import type { TrackedGoal } from "@/lib/tracker";
import { cn } from "@/lib/utils";

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular text-right", strong && "font-semibold")}>
        {value}
      </dd>
    </div>
  );
}

/** What it takes: the plain-language plan for a savings goal. */
export function SavingsPlan({ g }: { g: TrackedGoal }) {
  const needed = g.monthlySip + g.extraSipNeeded;
  return (
    <dl className="divide-y">
      <Row label="Going in each month" value={formatINR(g.monthlySip)} />
      {g.targetDate ? (
        <>
          {g.projected !== null && (
            <Row
              label={`Expected by ${monthYear(g.targetDate)}`}
              value={formatINR(g.projected)}
            />
          )}
          {g.status !== "reached" && (
            <Row
              label="Needed each month to be on time"
              value={formatINR(needed)}
              strong={g.extraSipNeeded > 0}
            />
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
      {g.lines.length > 0 && (
        <Row label="Expected growth" value={`about ${g.returnPct}% a year`} />
      )}
    </dl>
  );
}

export function LoanPlan({ g }: { g: TrackedGoal }) {
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
        On {formatDate(g.targetDate)} you&apos;ll still owe{" "}
        <b>{formatINR(g.futureTarget)}</b>. Put{" "}
        <b>{formatINR(needed)} a month</b> into your investments to close it
        then
        {g.interestSaved > 0 ? (
          <>
            , and save about <b>{formatINR(g.interestSaved)}</b> in interest
          </>
        ) : null}
        .
      </>
    );
  } else if (g.monthsToReach !== null) {
    plan = (
      <>
        At {formatINR(g.monthlySip)} a month, your savings catch up with what
        you owe around <b>{monthYear(g.reachDate)}</b>. Closing it then saves
        about <b>{formatINR(g.interestSaved)}</b> in interest.
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
        <Row
          label="This month: interest"
          value={formatINR(l.interestThisMonth)}
        />
        <Row
          label="This month: principal"
          value={formatINR(l.principalThisMonth)}
        />
        <Row
          label="Closes on its own"
          value={
            l.monthsLeft === null
              ? "Never at this EMI"
              : `${monthYear(l.endDate)} (${l.monthsLeft} EMIs)`
          }
        />
        {l.interestLeft !== null && (
          <Row
            label="Interest still to pay"
            value={formatINR(l.interestLeft)}
          />
        )}
      </dl>
      <p className="rounded-lg bg-muted p-3 text-sm">{plan}</p>
    </div>
  );
}
