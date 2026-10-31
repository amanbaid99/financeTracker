"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  DeleteGoalButton,
  EditGoalButton,
  GapChoices,
  GoalInvestments,
  SuggestionBox,
} from "@/components/goal-actions";
import type { SipStrategy } from "@/lib/sip-plan";
import type { Suggestion } from "@/lib/allocate";
import { BillsPlan, LoanPlan, SavingsPlan } from "@/components/goal-details";
import { GoalIcon } from "@/components/goal-icon";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatINR, formatINRCompact } from "@/lib/format";
import { groupGoals } from "@/lib/goal-summary";
import {
  goalHint,
  goalStatus,
  gapOptions,
  goalSubline,
  timeGroup,
  type GoalStatus,
} from "@/lib/goal-status";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";
import { cn } from "@/lib/utils";

function needLabel(g: TrackedGoal): string {
  if (g.loanState) {
    return g.targetDate && !g.emisCloseFirst
      ? `needed to close it on ${formatDate(g.targetDate)}`
      : g.loanState.feeRate > 0
        ? "needed to close it today"
        : "owed today";
  }
  return g.targetDate ? `needed by ${formatDate(g.targetDate)}` : "needed";
}

const PILL: Record<GoalStatus["tone"], string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  muted: "bg-muted text-muted-foreground",
};

export function StatusPill({ status }: { status: GoalStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        PILL[status.tone],
      )}
    >
      {status.label}
    </span>
  );
}

/** Goals as rows that expand in place to show the plan and investments. */
export function GoalList({
  goals,
  investments,
  links,
  today,
  initialOpen,
  suggestions = [],
  strategy = "diversified",
}: {
  suggestions?: Suggestion[];
  strategy?: SipStrategy;
  goals: TrackedGoal[];
  investments: Investment[];
  links: Link[];
  today: string;
  initialOpen: string | null;
}) {
  const [open, setOpen] = useState<string | null>(initialOpen);
  const [details, setDetails] = useState(false);

  const groups = groupGoals(goals);
  // Active goals by when they're due. Reached goals and loans the EMIs
  // already cover stay folded away below.
  const byTime = { soon: [], later: [], ongoing: [] } as Record<
    "soon" | "later" | "ongoing",
    TrackedGoal[]
  >;
  for (const g of [...groups.attention, ...groups.growing].sort(
    (a, b) => goals.indexOf(a) - goals.indexOf(b),
  ))
    byTime[timeGroup(g)].push(g);
  const renderGoals = (items: TrackedGoal[]) => (
    <ul className="space-y-3">
      {items.map((g) => {
        const suggestion = suggestions.find((x) => x.goalId === g.id);
        const st = goalStatus(g, today);
        const sub = goalSubline(g);
        const hint = goalHint(g, today, suggestion);
        // Still behind after the plan: offer ways to close the gap.
        const gap = gapOptions(g, today, suggestion?.monthly ?? 0);
        const isOpen = open === g.id;
        const panelId = `goal-${g.id}`;
        return (
          <li
            key={g.id}
            className={cn(
              "rounded-2xl border border-border/70 bg-card transition-colors hover:border-primary/40",
              isOpen && "border-primary",
            )}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => {
                setOpen(isOpen ? null : g.id);
                setDetails(false);
              }}
              className="press flex w-full items-start gap-3 p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <GoalIcon type={g.type} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words text-base font-semibold leading-snug">
                    {g.name}
                  </span>
                  <StatusPill status={st} />
                </div>
                {sub && (
                  <span className="block text-xs text-muted-foreground">
                    {sub}
                  </span>
                )}
                {!(g.loanState && g.emisCloseFirst) && (
                  <>
                    <Progress
                      className="h-1.5"
                      value={g.progress * 100}
                      tone="neutral"
                      label={`${g.name} progress`}
                    />
                    <p className="tabular flex items-baseline justify-between gap-3 text-sm">
                      <span>
                        {formatINRCompact(g.current)}
                        <span className="text-muted-foreground">
                          {/* A bills fund can hold more than it needs today. */}
                          {g.billsFund && g.current > g.futureTarget
                            ? ` · ${formatINRCompact(g.current - g.futureTarget)} extra`
                            : ` of ${formatINRCompact(g.futureTarget)}`}
                        </span>
                      </span>
                      {hint && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {hint}
                        </span>
                      )}
                    </p>
                  </>
                )}
              </div>
              <ChevronDown
                className={cn(
                  "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>

            {isOpen && (
              <div
                id={panelId}
                className="expand-in space-y-5 border-t px-4 pb-4 pt-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="tabular text-2xl font-semibold tracking-tight">
                      {formatINR(g.current)}
                    </p>
                    <p className="tabular text-xs text-muted-foreground">
                      {g.billsFund
                        ? `in the fund · should hold ${formatINR(g.futureTarget)} today`
                        : `saved of ${formatINR(g.emisCloseFirst ? 0 : g.futureTarget)} ${needLabel(g)}`}
                    </p>
                    {!g.loanState &&
                      !g.billsFund &&
                      g.futureTarget !== g.target && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatINR(g.target)} today, grown at {g.inflationPct}
                          % a year for rising prices.
                        </p>
                      )}
                  </div>
                  <EditGoalButton goal={g} today={today} />
                </div>

                {suggestion && (
                  <SuggestionBox
                    strategy={strategy}
                    goal={g}
                    suggestion={suggestion}
                    investments={investments}
                    links={links}
                    short={!!gap}
                  >
                    {gap && (
                      <GapChoices
                        goal={g}
                        options={gap}
                        today={today}
                        afterPlan
                      />
                    )}
                  </SuggestionBox>
                )}

                {g.loanState ? (
                  <LoanPlan g={g} details={details} verdict={!suggestion} />
                ) : g.billsFund ? (
                  <BillsPlan g={g} details={details} verdict={!suggestion} />
                ) : (
                  <SavingsPlan
                    g={g}
                    details={details}
                    verdict={!suggestion}
                    extra={
                      gap && <GapChoices goal={g} options={gap} today={today} />
                    }
                  />
                )}

                <GoalInvestments
                  goal={g}
                  investments={investments}
                  links={links}
                  hasPlanSuggestion={suggestions.some((x) => x.goalId === g.id)}
                />

                <button
                  type="button"
                  aria-expanded={details}
                  onClick={() => setDetails(!details)}
                  className="flex w-full items-center justify-center gap-1 text-sm font-medium text-primary"
                >
                  {details ? "Hide details" : "Show details"}
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      details && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {details && <DeleteGoalButton id={g.id} />}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-6">
      {(
        [
          ["soon", "Next 2 years", "soonest first"],
          ["later", "Later", ""],
          ["ongoing", "No fixed date", ""],
        ] as const
      ).map(
        ([key, title, note]) =>
          byTime[key].length > 0 && (
            <section
              key={key}
              aria-labelledby={`goals-${key}-h`}
              className="space-y-3"
            >
              <div className="flex items-baseline justify-between gap-2 px-0.5">
                <h2 id={`goals-${key}-h`} className="font-semibold">
                  {title}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {note || byTime[key].length}
                </span>
              </div>
              {renderGoals(byTime[key])}
            </section>
          ),
      )}
      {(
        [
          [
            "loans",
            "Loans covered by EMIs",
            "Your regular payments are working toward these. Open a loan to see its timeline.",
          ],
          [
            "reached",
            "Goals reached",
            "A moment to appreciate how far you've come.",
          ],
        ] as const
      ).map(
        ([key, title, description]) =>
          groups[key].length > 0 && (
            <details
              key={key}
              open={groups[key].some((g) => g.id === initialOpen) || undefined}
              className="group rounded-2xl border border-border/70 bg-muted/30 p-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
                <span>
                  {title}{" "}
                  <span className="ml-1 text-sm text-muted-foreground">
                    {groups[key].length}
                  </span>
                </span>
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="mt-3 space-y-3">
                <p className="text-sm text-muted-foreground">{description}</p>
                {renderGoals(groups[key])}
              </div>
            </details>
          ),
      )}
    </div>
  );
}
