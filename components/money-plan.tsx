"use client";

import { Pencil, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { savePlan } from "@/lib/actions";
import type { MoneyPlan } from "@/lib/allocate";
import { clearParam } from "@/lib/clear-param";
import { useQuickAction } from "@/components/quick-add";
import { formatINR, formatINRCompact } from "@/lib/format";

function PlanForm({
  plan,
  sipsNow,
  unassigned,
  onClose,
}: {
  plan: MoneyPlan | null;
  sipsNow: number;
  unassigned: number;
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
      router.refresh();
      onClose();
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
          Tell us what you can invest. We&apos;ll suggest how much goes to each
          goal. Nothing changes until you invest it yourself.
        </p>
        <Field label="Savings to put toward goals now" htmlFor="p-lump">
          <MoneyInput
            id="p-lump"
            value={lump}
            onChange={setLump}
            placeholder="e.g. 3,00,000"
          />
        </Field>
        {unassigned > 0 && (
          <p className="-mt-2 text-xs text-muted-foreground">
            You have {formatINR(unassigned)} in investments not linked to a
            goal.{" "}
            <button
              type="button"
              className="text-primary underline"
              onClick={() => setLump(unassigned)}
            >
              Use this amount
            </button>
          </p>
        )}
        <Field
          label="Can invest each month, in total"
          htmlFor="p-monthly"
          hint={
            sipsNow > 0
              ? `Includes the ${formatINR(sipsNow)} a month already going into SIPs.`
              : undefined
          }
        >
          <MoneyInput
            id="p-monthly"
            value={monthly}
            onChange={setMonthly}
            placeholder="e.g. 30,000"
          />
        </Field>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft p-2 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Suggest a split"}
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

/** The money plan: what you can invest and how it splits across goals. */
export function MoneyPlanCard({
  plan,
  sipsNow,
  unassigned,
  autoOpen = false,
}: {
  plan: MoneyPlan | null;
  sipsNow: number;
  unassigned: number;
  /** Open the form straight away (from the + menu). */
  autoOpen?: boolean;
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
      onClose={close}
    />
  );

  // With no plan yet, the way in is "Plan my money" in the + menu.
  if (!plan) return form || null;

  const { suggestions } = plan;
  let footer: { text: string; tone: string };
  if (plan.stillShortMonthly > 0) {
    footer = {
      text: `Still ${formatINR(plan.stillShortMonthly)} a month short of being on time`,
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

  return (
    <section
      className="space-y-3 rounded-2xl border bg-card p-4"
      aria-labelledby="plan-h"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="plan-h" className="flex items-center gap-1.5 font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden /> Your money
            plan
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatINR(plan.lump)} now · {formatINR(plan.monthlyFree)} a month
            free
            {plan.sipsNow > 0
              ? ` (after ${formatINR(plan.sipsNow)} of SIPs)`
              : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Edit money plan"
          onClick={() => setOpen(true)}
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
      </div>
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {plan.lump || plan.monthlyFree
            ? "Your goals don't need anything extra right now."
            : "Add savings or a monthly amount to get suggestions."}
        </p>
      ) : (
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
      )}
      <p className={`text-xs font-medium ${footer.tone}`}>{footer.text}</p>
      {form}
    </section>
  );
}
