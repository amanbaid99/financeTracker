"use client";

import { ArrowUpRight, ChevronDown, Pencil, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { savePlan } from "@/lib/actions";
import type { MoneyPlan, Suggestion } from "@/lib/allocate";
import { clearParam } from "@/lib/clear-param";
import { categoryLabel } from "@/lib/categories";
import { sipAction, sipPlan, type SipLine, type SipStrategy } from "@/lib/sip-plan";
import type { Investment, Link } from "@/lib/tracker";
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
const monthYearOf = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return `${"Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")[m - 1]} ${y}`;
};

/** The plan as SIPs: one per kind of fund, with the goals each one is for. */
function SipList({
  sips,
  lump,
  investments,
}: {
  sips: SipLine[];
  /** Goals that also get a lump sum now. */
  lump: Suggestion[];
  investments: Investment[];
}) {
  const once = lump.filter((s) => s.lump > 0);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sips : sips.slice(0, 3);
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Bills first, then dated goals, then goals without a date. These amounts
        are extra, on top of your current SIPs.
      </p>
      <ul className="space-y-3" aria-label="SIPs to start">
        {visible.map((l) => {
          const action = sipAction(l);
          return (
            <li key={l.investment?.id ?? `new-${l.category}`} className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-primary">{action.kind}</p>
                  <p className="break-words font-medium">{l.label}</p>
                </div>
                <span className="tabular shrink-0 font-semibold">+{formatINR(action.extra)}/mo</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatINR(action.current)}/mo now → {formatINR(action.total)}/mo total
              </p>
              {l.note && <p className="mt-1 text-xs text-muted-foreground">{l.note}</p>}
              {l.similar && <p className="mt-1 text-xs text-muted-foreground">
                Close enough to {categoryLabel(l.category).toLowerCase()}. Review whether this holding suits you.
              </p>}
              {!l.investment && <p className="mt-1 text-xs text-muted-foreground">You don&apos;t hold one yet. Choose a suitable holding before starting.</p>}
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer py-1 text-primary">See goal breakdown ({l.parts.length})</summary>
                <ul className="mt-1 space-y-1">
                  {l.parts.map((p) => (
                    <li key={p.goalId} className="flex justify-between gap-3">
                      <span className="min-w-0 break-words">{p.goalName}{p.until ? ` · review in ${monthYearOf(p.until)}` : ""}</span>
                      <span className="tabular shrink-0">{formatINR(p.monthly)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
      {sips.length > 3 && (
        <button type="button" className="w-full py-2 text-sm font-medium text-primary"
          aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer changes" : `Show all ${sips.length} changes`}
        </button>
      )}
      {sips.length > 3 && !showAll && <p className="text-xs text-muted-foreground">Showing 3 of {sips.length} changes. The monthly total includes the full list.</p>}
      {investments.some((i) => i.monthlySip > 0) && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer py-1 text-primary">Keep your existing SIPs</summary>
          <ul className="mt-2 space-y-1">
            {investments.filter((i) => i.monthlySip > 0).map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">{i.name?.trim() || categoryLabel(i.category)}</span>
                <span className="tabular shrink-0">{formatINR(i.monthlySip)}/mo</span>
              </li>
            ))}
          </ul>
          <p className="mt-2">The increases above are added to these amounts.</p>
        </details>
      )}
      {once.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Also put in now:{" "}
          {once
            .map((s) => `${formatINRCompact(s.lump)} for ${s.goalName}`)
            .join(", ")}
          .
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Review these changes before setting them up with your investment provider.
        When a goal is reached or its date arrives, review its contribution.
        Nothing is invested automatically. Not investment advice.
      </p>
    </div>
  );
}

export function MoneyPlanCard({
  plan,
  sipsNow,
  unassigned,
  investments = [],
  links = [],
  autoOpen = false,
  strategy,
  onStrategyChange,
}: {
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
  const [view, setView] = useState<"sips" | "goals">("sips");
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

  if (!plan) return (
    <section className="rounded-2xl border border-dashed border-primary/30 bg-card p-4" aria-label="Plan your money">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-2">
          <h2 className="font-semibold">Give your next rupee a purpose</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Choose what you can save. See how it could help your goals.</p>
          <Button type="button" size="sm" onClick={() => setOpen(true)}>Plan my money <ArrowUpRight className="size-4" aria-hidden /></Button>
        </div>
      </div>
      {form}
    </section>
  );

  const { suggestions } = plan;
  const sips = sipPlan(suggestions, investments, links, strategy);
  const extraMonthly = sips.reduce((sum, line) => sum + line.monthly, 0);
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
      className="space-y-3 rounded-2xl border border-primary/20 bg-card p-4"
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
      <p className={`text-sm font-medium leading-relaxed ${footer.tone}`}>{footer.text}</p>
      <details className="group/plan border-t pt-3">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">
          <span>Review your plan{extraMonthly > 0 ? ` · ${sips.length} ${sips.length === 1 ? "change" : "changes"}` : ""}</span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open/plan:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-3 pt-3">
      {sips.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-2" role="group" aria-label="SIP strategy">
            {(["diversified", "simple"] as const).map((choice) => (
              <button key={choice} type="button" aria-pressed={strategy === choice}
                onClick={() => onStrategyChange(choice)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${strategy === choice ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground"}`}>
                {choice === "simple" ? "Simple" : "Diversified"}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {strategy === "simple"
              ? "One suitable holding per goal, combined where the same holding is used. Existing goal links stay in place."
              : "Spread each goal across up to three suitable holdings you already own."}
            {" "}Compare without saving. Open a goal to review and record the chosen split after you invest.
          </p>
          <p className="text-sm font-medium">{formatINR(extraMonthly)} extra a month · {sips.length} {sips.length === 1 ? "change" : "changes"}</p>
        </div>
      )}
      {suggestions.length > 0 && sips.length > 0 && (
        <div
          className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
          role="tablist"
          aria-label="Show the plan"
        >
          {(
            [
              ["sips", "SIPs to start"],
              ["goals", "By goal"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-md px-2 py-1.5 text-sm ${view === v ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {view === "sips" && sips.length > 0 ? (
        <SipList
          sips={sips}
          lump={plan.lump > 0 ? suggestions : []}
          investments={investments}
        />
      ) : suggestions.length === 0 ? (
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
        </div>
      </details>
      {form}
    </section>
  );
}
