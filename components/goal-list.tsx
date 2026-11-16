"use client";

import { ChevronDown } from "lucide-react";
import NextLink from "next/link";
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
import { orderGoals } from "@/lib/goal-order";
import { monthYear } from "@/lib/goal-summary";
import {
  goalHint,
  goalStatus,
  onHold,
  gapOptions,
  goalSubline,
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

/** A loan's repayment: what's repaid of what you withdrew, or what's left. */
function LoanRepaid({ g }: { g: TrackedGoal }) {
  const st = g.loanState!;
  const principal = g.loan?.principal ?? null;
  const repaid =
    principal && principal > 0
      ? Math.max(0, Math.min(principal, principal - st.balance))
      : null;
  const end = st.endDate ? monthYear(st.endDate) : null;
  return (
    <>
      {repaid !== null && principal ? (
        <Progress
          className="h-1.5"
          value={(repaid / principal) * 100}
          tone="neutral"
          label={`${g.name} repaid`}
        />
      ) : null}
      <p className="tabular flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <span>
          {repaid !== null && principal ? (
            <>
              {formatINRCompact(repaid)}
              <span className="text-muted-foreground">
                {` repaid of ${formatINRCompact(principal)}`}
              </span>
            </>
          ) : (
            <>
              {formatINRCompact(st.balance)}
              <span className="text-muted-foreground"> left to repay</span>
            </>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {repaid !== null ? `${formatINRCompact(st.balance)} left` : ""}
          {repaid !== null && end ? " · " : ""}
          {end ? `ends ${end}` : ""}
        </span>
      </p>
    </>
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
  filter = null,
  between = false,
}: {
  /** Between jobs: savings goals wait for the salary instead of being behind. */
  between?: boolean;
  filter?: GoalStatus["tone"] | null;
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

  const filtered = filter
    ? goals.filter((g) => goalStatus(g, today, between).tone === filter)
    : goals;
  // Every goal in one list, in the plan's order. The first three are the
  // ones to focus on; nothing is folded away.
  const ordered = orderGoals(filtered, today, between);
  const top = ordered.slice(0, 3);
  const rest = ordered.slice(3);
  const renderGoals = (items: TrackedGoal[]) => (
    <ul className="space-y-3">
      {items.map((g) => {
        const suggestion = suggestions.find((x) => x.goalId === g.id);
        const st = goalStatus(g, today, between);
        const sub = goalSubline(g);
        const hint = goalHint(g, today, suggestion, between);
        const held = onHold(g, between);
        // Still behind after the plan: offer ways to close the gap.
        const gap = held
          ? null
          : gapOptions(g, today, suggestion?.monthly ?? 0);
        const isOpen = open === g.id;
        const panelId = `goal-${g.id}`;
        return (
          <li
            key={g.id}
            className={cn(
              "surface-card overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors hover:border-primary/40",
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
                  <StatusPill
                    status={
                      st.label === "Behind"
                        ? { ...st, label: "Behind today" }
                        : st
                    }
                  />
                </div>
                {(sub || g.niceToHave) && (
                  <span className="block text-xs text-muted-foreground">
                    {[sub, g.niceToHave && "Nice to have"]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                {g.loanState && <LoanRepaid g={g} />}
                {!(g.loanState && g.emisCloseFirst) && (
                  <>
                    {g.loanState && (
                      <p className="pt-1 text-xs font-medium text-muted-foreground">
                        Saved to close it early
                      </p>
                    )}
                    <Progress
                      className="h-1.5"
                      value={g.progress * 100}
                      tone="neutral"
                      label={`${g.name} progress`}
                    />
                    <p className="tabular flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
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
                        <span className="text-xs text-muted-foreground">
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
                    {gap && <GapChoices options={gap} afterPlan />}
                  </SuggestionBox>
                )}

                {g.loanState ? (
                  <LoanPlan g={g} details={details} verdict={!suggestion} />
                ) : g.billsFund ? (
                  <BillsPlan g={g} details={details} verdict={!suggestion} />
                ) : (
                  <SavingsPlan
                    g={g}
                    onHold={held}
                    details={details}
                    verdict={!suggestion}
                    extra={gap && <GapChoices options={gap} />}
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
                  className="flex min-h-11 w-full items-center justify-center gap-1 text-sm font-medium text-primary"
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
      {top.length > 0 && (
        <section aria-labelledby="goals-top-h" className="space-y-3">
          <div className="flex items-baseline justify-between gap-2 px-0.5">
            <h2 id="goals-top-h" className="font-semibold">
              Focus on these first
            </h2>
            <NextLink
              href="/goals/order"
              className="text-xs font-medium text-primary"
            >
              Change order
            </NextLink>
          </div>
          {renderGoals(top)}
        </section>
      )}
      {rest.length > 0 && (
        <section aria-labelledby="goals-rest-h" className="space-y-3">
          <h2 id="goals-rest-h" className="px-0.5 font-semibold">
            Everything else{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {rest.length}
            </span>
          </h2>
          {renderGoals(rest)}
        </section>
      )}
    </div>
  );
}
