"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import NextLink from "next/link";
import {
  DeleteGoalButton,
  EditGoalButton,
  GoalInvestments,
} from "@/components/goal-actions";
import type { SipStrategy } from "@/lib/sip-plan";
import type { Suggestion } from "@/lib/allocate";
import { GoalIcon } from "@/components/goal-icon";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatINR, formatINRCompact } from "@/lib/format";
import { orderGoals } from "@/lib/goal-order";
import { monthYear } from "@/lib/goal-summary";
import { goalStatus, goalSubline, type GoalStatus } from "@/lib/goal-status";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";
import { cn } from "@/lib/utils";

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

  const filtered = filter
    ? goals.filter((g) => goalStatus(g, today, between).tone === filter)
    : goals;
  // Essentials first, then flexible goals by deadline. The first three are the
  // ones to focus on; nothing is folded away.
  const ordered = orderGoals(filtered, today);
  const active = ordered.filter((g) => g.status !== "reached");
  const covered = ordered.filter((g) => g.status === "reached");
  const top = active.slice(0, 3);
  const rest = active.slice(3);
  const renderGoals = (items: TrackedGoal[]) => (
    <ul className="space-y-3">
      {items.map((g) => {
        const st = goalStatus(g, today, between);
        const sub = g.loanState
          ? g.targetDate
            ? `Close by ${monthYear(g.targetDate)}`
            : ""
          : goalSubline(g);
        const isOpen = open === g.id;
        const panelId = `goal-${g.id}`;
        return (
          <li
            key={g.id}
            className={cn(
              "overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors hover:border-primary/40",
              isOpen && "border-primary",
            )}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => {
                setOpen(isOpen ? null : g.id);
              }}
              className="press flex w-full items-start gap-3 p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <GoalIcon type={g.type} className="size-8 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words text-base font-semibold leading-snug">
                    {g.name}
                  </span>
                  <StatusPill status={st} />
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
                      <span className="text-xs text-muted-foreground">
                        {Math.round(g.progress * 100)}% saved
                      </span>
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
                className="expand-in space-y-3 border-t px-4 pb-3 pt-3"
              >
                <PlannedSip goal={g} />
                <GoalInvestments
                  goal={g}
                  investments={investments}
                  links={links}
                  simple
                />
                {g.billsFund && g.billsFund.upcoming.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Upcoming payments</h3>
                    <ul className="divide-y">
                      {g.billsFund.upcoming.slice(0, 3).map((bill, index) => (
                        <li
                          key={`${bill.date}-${index}`}
                          className="flex justify-between gap-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="break-words">{bill.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(bill.date)}
                            </p>
                          </div>
                          <span className="tabular shrink-0">
                            {formatINR(bill.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <div className="flex items-start justify-between gap-3 border-t pt-3">
                  <DeleteGoalButton id={g.id} loanId={g.loanId} />
                  <EditGoalButton goal={g} today={today} />
                </div>
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
              Focus goals
            </h2>
          </div>
          {renderGoals(top)}
        </section>
      )}
      {rest.length > 0 && (
        <section aria-labelledby="goals-rest-h" className="space-y-3">
          <h2 id="goals-rest-h" className="px-0.5 font-semibold">
            Other goals{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {rest.length}
            </span>
          </h2>
          {renderGoals(rest)}
        </section>
      )}
      {covered.length > 0 && (
        <section aria-labelledby="goals-covered-h" className="space-y-3">
          <h2 id="goals-covered-h" className="px-0.5 font-semibold">
            Covered{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {covered.length}
            </span>
          </h2>
          {renderGoals(covered)}
        </section>
      )}
    </div>
  );
}

/** What your SIPs on Budget put into this goal each month, against its need. */
function PlannedSip({ goal: g }: { goal: TrackedGoal }) {
  if (g.plannedMonthly === undefined) return null;
  const need = g.billsFund
    ? Math.ceil(g.billsFund.monthlyNeed)
    : Math.ceil(g.monthlySip + g.extraSipNeeded);
  const planned = g.plannedMonthly;
  const short = Math.max(0, need - planned);
  return (
    <NextLink
      href="/goals/budget#sips"
      className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm"
    >
      <span>
        <span className="tabular font-medium">{formatINR(planned)}</span> a
        month from your SIPs
      </span>
      <span
        className={cn(
          "shrink-0 text-xs",
          need === 0 || short === 0 ? "text-success" : "text-warning",
        )}
      >
        {need === 0
          ? "Nothing more needed"
          : short === 0
            ? "Enough to be on time"
            : `${formatINR(short)} more needed`}
      </span>
    </NextLink>
  );
}
