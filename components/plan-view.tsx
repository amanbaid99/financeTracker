"use client";

import { useState } from "react";
import { MoneyPlanCard } from "@/components/money-plan";
import type { MoneyPlan, PlanStage, Suggestion } from "@/lib/allocate";
import type { Budget } from "@/lib/budget";
import { formatINR } from "@/lib/format";
import type { SipStrategy } from "@/lib/sip-plan";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";
import { cn } from "@/lib/utils";

/** The plan's steps in the order it funds them, with why. */
const STAGES: {
  key: PlanStage;
  title: string;
  why: string;
  color: string;
}[] = [
  {
    key: "bills",
    title: "Bills coming up",
    why: "Payments due in the next 12 months come first, so they're never short.",
    color: "bg-series-1",
  },
  {
    key: "emergency",
    title: "Emergency cushion",
    why: "3 months of essentials, built within a year, before other goals grow.",
    color: "bg-series-2",
  },
  {
    key: "soon",
    title: "Goals in the next 5 years",
    why: "Just enough for each to be on time. Nearest first, must-haves before nice-to-haves.",
    color: "bg-series-3",
  },
  {
    key: "long",
    title: "Goals 5+ years away",
    why: "A fifth of your money keeps these growing, so they aren't always last.",
    color: "bg-series-4",
  },
  {
    key: "open",
    title: "Goals with no date",
    why: "What's left, shared by how much each still needs.",
    color: "bg-series-5",
  },
];

const amounts = (s: Suggestion) =>
  [
    s.monthly ? `${formatINR(s.monthly)}/mo` : "",
    s.lump ? `${formatINR(s.lump)} once` : "",
  ]
    .filter(Boolean)
    .join(" + ");

function afterText(s: Suggestion): { text: string; tone: string } {
  const a = s.after;
  if (a.status === "reached" || a.status === "on_track")
    return { text: "On track with this", tone: "text-success" };
  if (a.billsFund && !a.billsFund.short)
    return { text: "Every payment covered", tone: "text-success" };
  if (a.extraSipNeeded > 0)
    return {
      text: `Still ${formatINR(a.extraSipNeeded)}/mo short`,
      tone: "text-warning",
    };
  return { text: "Closer with this", tone: "text-muted-foreground" };
}

export function PlanView(props: {
  plan: MoneyPlan;
  budget: Budget;
  goals: TrackedGoal[];
  investments: Investment[];
  links: Link[];
  sipsNow: number;
  unassigned: number;
  budgetMonthly: number | null;
}) {
  const { plan, budget } = props;
  const [strategy, setStrategy] = useState<SipStrategy>("diversified");
  const byStage = STAGES.map((st) => ({
    ...st,
    items: plan.suggestions.filter((s) => s.stage === st.key),
  })).filter((st) => st.items.length > 0);
  const monthlyOf = (items: Suggestion[]) =>
    items.reduce((t, s) => t + s.monthly, 0);
  const newMonthly = monthlyOf(plan.suggestions);
  const lumpTotal = plan.suggestions.reduce((t, s) => t + s.lump, 0);
  const over =
    budget.income > 0 && plan.monthlyTotal > budget.planMonthly
      ? plan.monthlyTotal - budget.planMonthly
      : 0;

  return (
    <div className="space-y-5">
      <section
        aria-label="Plan summary"
        className="surface-card space-y-4 rounded-2xl border bg-card p-4"
      >
        <div>
          <p className="text-xs text-muted-foreground">Investing each month</p>
          <p className="tabular text-3xl font-semibold tracking-tight">
            {formatINR(plan.monthlyTotal)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>
              {formatINR(plan.sipsNow)} already going in
              {newMonthly > 0 && ` · ${formatINR(newMonthly)} new`}
            </span>
            {lumpTotal > 0 && <span>plus {formatINR(lumpTotal)} once</span>}
            {over > 0 && (
              <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning">
                {formatINR(over)} over your budget
              </span>
            )}
          </p>
        </div>
        {newMonthly > 0 && (
          <div className="space-y-2">
            <div
              className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
              aria-hidden
            >
              {byStage.map((st) => {
                const m = monthlyOf(st.items);
                return m > 0 ? (
                  <span
                    key={st.key}
                    className={cn("h-full", st.color)}
                    style={{ width: `${(m / newMonthly) * 100}%` }}
                  />
                ) : null;
              })}
            </div>
            <ul className="space-y-1 text-xs">
              {byStage.map((st) => (
                <li key={st.key} className="flex items-center gap-1.5">
                  <span
                    className={cn("size-2 shrink-0 rounded-full", st.color)}
                    aria-hidden
                  />
                  <span className="truncate text-muted-foreground">
                    {st.title}
                  </span>
                  <span className="tabular ml-auto font-medium">
                    {formatINR(monthlyOf(st.items))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p
          className={cn(
            "rounded-lg p-2.5 text-sm",
            plan.stillShortMonthly > 0
              ? "bg-warning-soft text-warning"
              : "bg-success-soft text-success",
          )}
        >
          {plan.stillShortMonthly > 0
            ? `Your dated goals still need ${formatINR(plan.stillShortMonthly)} a month more to be on time.`
            : "Every dated goal is on time with this plan."}
          {plan.leftoverMonthly > 0 &&
            ` ${formatINR(plan.leftoverMonthly)} a month is left over.`}
        </p>
      </section>

      <section aria-labelledby="why-h" className="space-y-3">
        <div className="px-0.5">
          <h2 id="why-h" className="font-semibold">
            Where it goes, and why
          </h2>
          <p className="text-xs text-muted-foreground">
            The plan fills these in order, top to bottom.
          </p>
        </div>
        <ol className="space-y-3">
          {byStage.map((st, i) => (
            <li
              key={st.key}
              className="surface-card rounded-2xl border bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                    st.color,
                  )}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-medium">{st.title}</h3>
                    <span className="tabular shrink-0 text-sm font-semibold">
                      {formatINR(monthlyOf(st.items))}/mo
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{st.why}</p>
                </div>
              </div>
              <ul className="mt-3 divide-y border-t">
                {st.items.map((s) => {
                  const after = afterText(s);
                  return (
                    <li key={s.goalId} className="py-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium">
                          {s.goalName}
                        </span>
                        <span className="tabular shrink-0 text-sm">
                          {amounts(s)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="min-w-0 text-muted-foreground">
                          {s.categoryLabel}: {s.why}
                        </span>
                        <span className={cn("shrink-0", after.tone)}>
                          {after.text}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <MoneyPlanCard
        {...props}
        variant="full"
        strategy={strategy}
        onStrategyChange={setStrategy}
      />
      <p className="text-xs text-muted-foreground">
        Suggestions only, not investment advice. Nothing changes until you tick
        a step or save a form.
      </p>
    </div>
  );
}
