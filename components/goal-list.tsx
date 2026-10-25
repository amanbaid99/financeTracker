"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  DeleteGoalButton,
  EditGoalButton,
  GoalInvestments,
  SuggestionBox,
} from "@/components/goal-actions";
import type { Suggestion } from "@/lib/allocate";
import { LoanPlan, SavingsPlan } from "@/components/goal-details";
import { GoalIcon } from "@/components/goal-icon";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatINR, formatINRCompact } from "@/lib/format";
import { goalHeadline, TONE_BAR, TONE_TEXT } from "@/lib/goal-summary";
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

/** Goals as rows that expand in place to show the plan and investments. */
export function GoalList({
  goals,
  investments,
  links,
  today,
  initialOpen,
  suggestions = [],
}: {
  suggestions?: Suggestion[];
  goals: TrackedGoal[];
  investments: Investment[];
  links: Link[];
  today: string;
  initialOpen: string | null;
}) {
  const [open, setOpen] = useState<string | null>(initialOpen);

  return (
    <ul className="space-y-3">
      {goals.map((g) => {
        const h = goalHeadline(g);
        const isOpen = open === g.id;
        const panelId = `goal-${g.id}`;
        return (
          <li
            key={g.id}
            className={cn(
              "rounded-2xl border bg-card",
              isOpen && "border-primary",
            )}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : g.id)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <GoalIcon type={g.type} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{g.name}</span>
                  <span className="tabular shrink-0 text-xs text-muted-foreground">
                    {formatINRCompact(g.current)} /{" "}
                    {formatINRCompact(g.futureTarget || g.target)}
                  </span>
                </div>
                <Progress
                  value={g.progress * 100}
                  tone={TONE_BAR[h.tone]}
                  label={`${g.name} progress`}
                />
                <p
                  className={cn(
                    "truncate text-xs font-medium",
                    TONE_TEXT[h.tone],
                  )}
                >
                  {h.text}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>

            {isOpen && (
              <div id={panelId} className="space-y-5 border-t px-4 pb-4 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="tabular text-2xl font-semibold tracking-tight">
                      {formatINR(g.current)}
                    </p>
                    <p className="tabular text-xs text-muted-foreground">
                      saved of{" "}
                      {formatINR(g.emisCloseFirst ? 0 : g.futureTarget)}{" "}
                      {needLabel(g)}
                    </p>
                    {!g.loanState && g.futureTarget !== g.target && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatINR(g.target)} today, grown at {g.inflationPct}%
                        a year for rising prices.
                      </p>
                    )}
                  </div>
                  <EditGoalButton goal={g} today={today} />
                </div>

                {g.loanState ? <LoanPlan g={g} /> : <SavingsPlan g={g} />}

                {suggestions.find((x) => x.goalId === g.id) && (
                  <SuggestionBox
                    goal={g}
                    suggestion={suggestions.find((x) => x.goalId === g.id)!}
                    investments={investments}
                    links={links}
                  />
                )}

                <GoalInvestments
                  goal={g}
                  investments={investments}
                  links={links}
                />

                <DeleteGoalButton id={g.id} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
