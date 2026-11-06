"use client";

import { ArrowUpRight, Check, ChevronDown, Plus, Sparkles } from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { BudgetDetails } from "@/components/budget-card";
import type { Budget } from "@/lib/budget";
import { InvestmentSheet } from "@/components/investment-sheet";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import {
  applyPlanStep,
  savePlan,
  undoPlanStep,
  type PlanStepUndo,
} from "@/lib/actions";
import type { MoneyPlan } from "@/lib/allocate";
import { clearParam } from "@/lib/clear-param";
import {
  planSteps,
  sipPlan,
  type PlanStep,
  type SipStrategy,
} from "@/lib/sip-plan";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";
import { useQuickAction } from "@/components/quick-add";
import { formatINR, formatINRCompact } from "@/lib/format";

function PlanForm({
  plan,
  sipsNow,
  unassigned,
  budgetMonthly,
  onClose,
}: {
  plan: MoneyPlan | null;
  sipsNow: number;
  unassigned: number;
  /** What the budget leaves for investing each month, SIPs included. */
  budgetMonthly: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [lump, setLump] = useState<number | null>(plan?.lump ?? null);
  const [monthly, setMonthly] = useState<number | null>(
    plan?.monthlyTotal ?? (sipsNow || null),
  );
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = (input: { lump: number; monthly: number } | null) =>
    start(async () => {
      setError("");
      const res = await savePlan(input);
      if (!res.ok) return setError(res.error);
      onClose();
      // A saved plan opens on its own page.
      if (input) router.push("/goals/plan");
      router.refresh();
    });

  return (
    <Sheet title="Plan my money" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run({ lump: lump ?? 0, monthly: monthly ?? 0 });
        }}
      >
        <p className="text-sm text-muted-foreground">
          Choose your monthly budget. We&apos;ll suggest where it goes.
        </p>
        <Field
          label="Monthly investment budget"
          htmlFor="p-monthly"
          hint={
            sipsNow > 0
              ? `Include the ${formatINR(sipsNow)} a month you already invest.`
              : "The total you can invest each month."
          }
        >
          <MoneyInput
            id="p-monthly"
            value={monthly}
            onChange={setMonthly}
            placeholder="e.g. 30,000"
          />
        </Field>
        {budgetMonthly !== null && budgetMonthly !== monthly && (
          <p className="-mt-2 text-xs text-muted-foreground">
            Your budget leaves {formatINR(budgetMonthly)} a month.{" "}
            <button
              type="button"
              className="text-primary underline"
              onClick={() => setMonthly(budgetMonthly)}
            >
              Use this amount
            </button>
          </p>
        )}
        <details open={Boolean(plan?.lump)} className="border-t pt-3">
          <summary className="cursor-pointer py-1 text-sm font-medium text-primary">
            Add a one-time amount
          </summary>
          <div className="mt-3 space-y-3">
            <Field label="Savings to put toward goals now" htmlFor="p-lump">
              <MoneyInput
                id="p-lump"
                value={lump}
                onChange={setLump}
                placeholder="e.g. 3,00,000"
              />
            </Field>
            {unassigned > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatINR(unassigned)} is not linked to a goal.{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => setLump(unassigned)}
                >
                  Use this amount
                </button>
              </p>
            )}
          </div>
        </details>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft p-2 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Show my plan"}
        </Button>
        {plan && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={pending}
            onClick={() => run(null)}
          >
            Remove plan
          </Button>
        )}
      </form>
    </Sheet>
  );
}

/** How long a ticked step stays on screen, with Undo, before it goes. */
const UNDO_MS = 10000;

const amountsOf = (st: PlanStep) =>
  [
    st.addLump ? `${formatINR(st.addLump)} now` : "",
    st.addMonthly ? `${formatINR(st.addMonthly)}/mo` : "",
  ]
    .filter(Boolean)
    .join(" + ");

/**
 * This month's plan as a checklist. Ticking a step records it on that
 * holding (SIP raised, one-time amount added), shows Undo for a few
 * seconds, then the step leaves the list.
 */
function Checklist({
  steps,
  investments,
  links,
}: {
  steps: PlanStep[];
  investments: Investment[];
  links: Link[];
}) {
  const router = useRouter();
  // Ticked steps, kept on screen (with Undo) for a few seconds even though
  // the saved change already took them out of the plan.
  const [ticked, setTicked] = useState<
    Record<string, { undo: PlanStepUndo; step: PlanStep; at: number }>
  >({});
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<PlanStep | null>(null);
  const [showAll, setShowAll] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);
  // A step is identified by what it asks, so a changed amount shows again.
  const idOf = (st: PlanStep) => `${st.key}:${st.addMonthly}:${st.addLump}`;
  const visible = steps.filter((st) => !gone.has(idOf(st)));
  for (const [id, t] of Object.entries(ticked))
    if (!gone.has(id) && !visible.some((st) => idOf(st) === id))
      visible.splice(Math.min(t.at, visible.length), 0, t.step);
  const shown = showAll ? visible : visible.slice(0, 2);

  const tick = async (st: PlanStep) => {
    if (!st.investment) return;
    const id = idOf(st);
    setBusy(id);
    setError("");
    const res = await applyPlanStep({
      investmentId: st.investment.id,
      addMonthly: st.addMonthly,
      addLump: st.addLump,
      goalIds: st.goals.map((g) => g.id),
    });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    const at = steps.findIndex((x) => idOf(x) === id);
    setTicked((t) => ({ ...t, [id]: { undo: res.undo, step: st, at } }));
    timers.current.set(
      id,
      setTimeout(() => {
        setGone((g) => new Set(g).add(id));
        router.refresh();
      }, UNDO_MS),
    );
  };
  const undo = async (st: PlanStep) => {
    const id = idOf(st);
    const prev = ticked[id]?.undo;
    if (!prev) return;
    clearTimeout(timers.current.get(id));
    setBusy(id);
    const res = await undoPlanStep(prev);
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setTicked((t) => {
      const next = { ...t };
      delete next[id];
      return next;
    });
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border/60" aria-label="This month's steps">
        {shown.map((st) => {
          const id = idOf(st);
          const done = !!ticked[id];
          const goals = st.goals.map((g) => g.name).join(", ");
          return (
            <li key={id} className="flex items-start gap-2 py-2 text-sm">
              {st.investment ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`Done: ${amountsOf(st)} into ${st.label}`}
                  disabled={busy === id || done}
                  onClick={() => tick(st)}
                  className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-primary hover:bg-primary-soft ${busy === id ? "animate-pulse" : ""}`}
                >
                  <span
                    className={`inline-flex size-5 items-center justify-center rounded-md border-2 border-primary/60 ${done ? "bg-primary text-primary-foreground" : ""}`}
                  >
                    {done && (
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    )}
                  </span>
                </button>
              ) : (
                <Plus
                  className="mt-0.5 size-5 shrink-0 opacity-80"
                  aria-hidden
                />
              )}
              <span
                className={`min-w-0 flex-1 py-1 ${done ? "opacity-70" : ""}`}
              >
                <span
                  className={`block break-words ${done ? "line-through" : ""}`}
                >
                  <span className="tabular">{amountsOf(st)}</span> into{" "}
                  <b>{st.label}</b>
                </span>
                <span className="block text-xs opacity-80">
                  {done ? "Recorded. Undo is available for 10 seconds." : goals}
                  {!done && st.note ? ` · ${st.note}` : ""}
                </span>
              </span>
              {done ? (
                <button
                  type="button"
                  onClick={() => undo(st)}
                  disabled={busy === id}
                  className="min-h-11 shrink-0 px-2 text-xs font-semibold text-primary underline underline-offset-2"
                >
                  Undo
                </button>
              ) : (
                !st.investment && (
                  <button
                    type="button"
                    onClick={() => setAdding(st)}
                    className="min-h-11 shrink-0 rounded-lg bg-primary-soft px-2.5 text-xs font-semibold text-primary"
                  >
                    Add it
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>
      {visible.length > 2 && (
        <button
          type="button"
          className="min-h-11 w-full rounded-xl bg-muted/60 text-sm font-medium text-primary hover:bg-muted"
          aria-expanded={showAll}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Show fewer" : `Show all ${visible.length}`}
        </button>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-card p-2 text-sm text-danger">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Tick to record what you set up with your provider. No money is moved.
      </p>
      {adding && (
        <InvestmentSheet
          goalId={adding.goals[0]?.id ?? null}
          goalName={adding.goals[0]?.name}
          linkedIds={links
            .filter((l) => l.goalId === adding.goals[0]?.id)
            .map((l) => l.investmentId)}
          investment={null}
          percent={null}
          investments={investments}
          links={links}
          onClose={() => setAdding(null)}
          prefill={{
            fundCategory: adding.category,
            value: adding.addLump,
            monthlySip: adding.addMonthly,
          }}
        />
      )}
    </div>
  );
}

export function MoneyPlanCard({
  plan,
  sipsNow,
  unassigned,
  budget,
  investments = [],
  links = [],
  autoOpen = false,
  budgetMonthly = null,
  strategy,
  onStrategyChange,
  goals = [],
  variant = "summary",
}: {
  /** "summary" is the small row on Goals; "full" is the plan page. */
  variant?: "summary" | "full";
  /** To say what the goals still need before there's a plan. */
  goals?: TrackedGoal[];
  budget: Budget;
  budgetMonthly?: number | null;
  plan: MoneyPlan | null;
  sipsNow: number;
  unassigned: number;
  /** Your investments and goal links, to name your own funds in the SIP plan. */
  investments?: Investment[];
  links?: Link[];
  /** Open the form straight away (from the + menu). */
  autoOpen?: boolean;
  strategy: SipStrategy;
  onStrategyChange: (strategy: SipStrategy) => void;
}) {
  const [open, setOpen] = useState(autoOpen);
  const close = useCallback(() => {
    setOpen(false);
    clearParam("do");
  }, []);
  useQuickAction(
    "plan",
    useCallback(() => setOpen(true), []),
  );
  const form = open && (
    <PlanForm
      plan={plan}
      sipsNow={sipsNow}
      unassigned={unassigned}
      budgetMonthly={budgetMonthly}
      onClose={close}
    />
  );

  const needed = goals
    .filter((g) => g.status !== "reached" && !g.emisCloseFirst)
    .reduce((s, g) => s + g.extraSipNeeded, 0);
  if (!plan)
    return (
      <section
        className="surface-card overflow-hidden rounded-2xl border bg-card"
        aria-label="Plan your money"
      >
        <button
          type="button"
          aria-label="Plan my money"
          onClick={() => setOpen(true)}
          className="press flex min-h-18 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
            aria-hidden
          >
            <Sparkles className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Plan my money</span>
            <span className="block text-xs text-muted-foreground">
              {needed > 0
                ? `Your goals need about ${formatINR(Math.round(needed / 1000) * 1000)} a month more. See how to split what you can.`
                : "Split your monthly savings across goals."}
            </span>
          </span>
          <ArrowUpRight className="size-4 shrink-0 text-primary" aria-hidden />
        </button>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4">
          <NextLink
            href="/goals/budget"
            className="inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground hover:text-primary"
          >
            {budget.income > 0 ? "Edit budget" : "Set up a budget"}
          </NextLink>
          {budget.income <= 0 && (
            <span className="text-xs text-muted-foreground">Optional</span>
          )}
        </div>
        {form}
      </section>
    );

  const { suggestions } = plan;
  const sips = sipPlan(suggestions, investments, links, strategy);
  const steps = planSteps(suggestions, investments, links, strategy);
  const extraMonthly = sips.reduce((sum, line) => sum + line.monthly, 0);
  let footer: { text: string; tone: string };
  if (plan.stillShortMonthly > 0) {
    footer = {
      text: `Still ${formatINR(plan.stillShortMonthly)} a month short of being on time. Open a goal marked Behind to see your options.`,
      tone: "text-warning",
    };
  } else if (plan.leftoverLump > 0 || plan.leftoverMonthly > 0) {
    footer = {
      text: `Every dated goal is covered. ${[plan.leftoverLump ? `${formatINR(plan.leftoverLump)} now` : "", plan.leftoverMonthly ? `${formatINR(plan.leftoverMonthly)} a month` : ""].filter(Boolean).join(" and ")} left over.`,
      tone: "text-success",
    };
  } else {
    footer = {
      text: "Every dated goal is covered with this plan.",
      tone: "text-success",
    };
  }

  if (variant === "summary") {
    const over =
      budget.income > 0 && plan.monthlyTotal > budget.planMonthly
        ? plan.monthlyTotal - budget.planMonthly
        : 0;
    return (
      <section
        className="surface-card overflow-hidden rounded-2xl border border-primary/15 bg-card"
        aria-label="Your money plan"
      >
        <NextLink
          href="/goals/plan"
          className="press flex min-h-18 w-full items-center gap-3 px-4 py-3 hover:bg-muted/40"
        >
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
            aria-hidden
          >
            <Sparkles className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              Your plan:{" "}
              <span className="tabular">{formatINR(plan.monthlyTotal)}</span> a
              month
            </span>
            <span className="block text-xs text-muted-foreground">
              {steps.length > 0
                ? `${steps.length} ${steps.length === 1 ? "step" : "steps"} to set up this month`
                : "Nothing to set up right now"}
              {over > 0 && (
                <span className="text-warning">
                  {" "}
                  · {formatINR(over)} over budget
                </span>
              )}
            </span>
          </span>
          <span className="shrink-0 text-sm font-medium text-primary">
            View plan
          </span>
        </NextLink>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4">
          <NextLink
            href="/goals/budget"
            className="inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground hover:text-primary"
          >
            {budget.income > 0 ? "Edit budget" : "Set budget"}
          </NextLink>
          {budget.income > 0 && (
            <span className="tabular text-xs text-muted-foreground">
              {formatINR(budget.planMonthly)} a month to invest
            </span>
          )}
        </div>
        {form}
      </section>
    );
  }

  return (
    <section
      className="surface-card space-y-3 rounded-2xl border border-primary/15 bg-card p-4 text-card-foreground"
      aria-labelledby="plan-h"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id="plan-h" className="flex items-center gap-1.5 font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden /> This month
        </h2>
        <button
          type="button"
          aria-label="Edit money plan"
          onClick={() => setOpen(true)}
          className="-mr-1 -mt-2 min-h-11 rounded-lg px-2 text-sm text-primary hover:bg-primary-soft"
        >
          Edit plan
        </button>
      </div>
      {steps.length > 0 ? (
        <Checklist steps={steps} investments={investments} links={links} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {plan.lump || plan.monthlyFree
            ? "You're all set. Your goals don't need anything extra right now."
            : "Add savings or a monthly amount to get suggestions."}
        </p>
      )}
      {(suggestions.length > 0 || budget.income > 0) && (
        <details className="group/plan border-t text-card-foreground">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            Budget and plan details
            <ChevronDown
              className="size-4 shrink-0 transition-transform group-open/plan:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="space-y-3 px-3 pb-3">
            <BudgetDetails
              b={budget}
              planMonthly={plan.monthlyTotal}
              expanded
            />
            <p className={`text-sm ${footer.tone}`}>{footer.text}</p>
            <p className="text-xs text-muted-foreground">
              Budget: {formatINR(plan.monthlyTotal)}/month. Going in now:{" "}
              {formatINR(plan.sipsNow)}/month. Suggested increase:{" "}
              {formatINR(extraMonthly)}/month.
            </p>
            <p className="text-xs font-medium">By goal</p>
            <ul className="divide-y text-sm">
              {suggestions.map((s) => (
                <li
                  key={s.goalId}
                  className="flex items-baseline justify-between gap-3 py-2"
                >
                  <span className="min-w-0 truncate">{s.goalName}</span>
                  <span className="tabular shrink-0 text-right font-medium">
                    {[
                      s.lump ? `${formatINRCompact(s.lump)} now` : "",
                      s.monthly ? `${formatINR(s.monthly)}/mo` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
            {sips.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-sm font-medium">
                  How to split the extra money
                </p>
                <div
                  className="flex gap-2"
                  role="group"
                  aria-label="SIP strategy"
                >
                  {(["diversified", "simple"] as const).map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      aria-pressed={strategy === choice}
                      onClick={() => onStrategyChange(choice)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${strategy === choice ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground"}`}
                    >
                      {choice === "simple"
                        ? "One holding per goal"
                        : "Spread across holdings"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Changes the steps above. Nothing is saved until you tick one.
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Not investment advice.
            </p>
          </div>
        </details>
      )}
      {form}
    </section>
  );
}
