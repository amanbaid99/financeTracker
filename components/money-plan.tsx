"use client";

import { ArrowUpRight, ChevronDown, Pencil, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { savePlan } from "@/lib/actions";
import type { MoneyPlan } from "@/lib/allocate";
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
        <p className="text-sm text-muted-foreground">Choose your monthly budget. We&apos;ll suggest where it goes.</p>
        <Field label="Monthly investment budget" htmlFor="p-monthly"
          hint={sipsNow > 0 ? `Include the ${formatINR(sipsNow)} a month you already invest.` : "The total you can invest each month."}>
          <MoneyInput id="p-monthly" value={monthly} onChange={setMonthly} placeholder="e.g. 30,000" />
        </Field>
        <details open={Boolean(plan?.lump)} className="border-t pt-3">
          <summary className="cursor-pointer py-1 text-sm font-medium text-primary">Add a one-time amount</summary>
          <div className="mt-3 space-y-3">
            <Field label="Savings to put toward goals now" htmlFor="p-lump">
              <MoneyInput id="p-lump" value={lump} onChange={setLump} placeholder="e.g. 3,00,000" />
            </Field>
            {unassigned > 0 && <p className="text-xs text-muted-foreground">{formatINR(unassigned)} is not linked to a goal. <button type="button" className="text-primary underline" onClick={() => setLump(unassigned)}>Use this amount</button></p>}
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

/** The money plan: what you can invest and how it splits across goals. */
const monthYearOf = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return `${"Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")[m - 1]} ${y}`;
};

/** The plan as SIPs: one per kind of fund, with the goals each one is for. */
function SipList({ sips }: { sips: SipLine[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sips : sips.slice(0, 3);
  return <div className="space-y-2 text-sm">
    <p className="text-xs text-muted-foreground">Set these amounts with your provider. Keep your other monthly investments going.</p>
    <ul className="divide-y" aria-label="Monthly investment changes">
      {visible.map(l => {
        const action = sipAction(l);
        return <li key={l.investment?.id ?? `new-${l.category}`}>
          <details>
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1">
                <span className="block break-words font-medium">{l.label}</span>
                <span className="block text-xs text-muted-foreground">{!l.investment ? "Choose a suitable holding first" : action.current > 0 ? "Increase to" : "Start"}</span>
              </span>
              <span className="tabular shrink-0 text-right font-semibold">{formatINR(action.total)}<span className="block text-xs font-normal text-muted-foreground">/month</span></span>
              <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
            </summary>
            <div className="space-y-2 pb-3 text-xs text-muted-foreground">
              {action.current > 0 && <p>{formatINR(action.current)}/month now, plus {formatINR(action.extra)}/month.</p>}
              {l.note && <p>{l.note}</p>}
              {l.similar && <p>Review whether this holding suits a {categoryLabel(l.category).toLowerCase()} need.</p>}
              <p className="font-medium">What this supports</p>
              <ul className="space-y-1">{l.parts.map(p => <li key={p.goalId} className="flex justify-between gap-3"><span className="min-w-0 break-words">{p.goalName}{p.until ? ` · review in ${monthYearOf(p.until)}` : ""}</span><span className="tabular shrink-0">{formatINR(p.monthly)}</span></li>)}</ul>
            </div>
          </details>
        </li>;
      })}
    </ul>
    {sips.length > 3 && <button type="button" className="min-h-10 w-full text-sm font-medium text-primary" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer changes" : `Show all ${sips.length} changes`}</button>}
    {sips.length > 3 && !showAll && <p className="text-xs text-muted-foreground">Showing 3 of {sips.length} changes. The total includes them all.</p>}
    <p className="text-xs text-muted-foreground">Nothing is invested automatically. Not investment advice.</p>
  </div>;
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
    <section className="rounded-2xl border bg-card" aria-label="Plan your money">
      <button type="button" aria-label="Plan my money" onClick={() => setOpen(true)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Plan my money</span>
          <span className="block text-xs text-muted-foreground">Choose what you can invest.</span>
        </span>
        <ArrowUpRight className="size-4 shrink-0 text-primary" aria-hidden />
      </button>
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
            {formatINR(plan.sipsNow + extraMonthly)}/month after these changes
            {plan.lump > 0 ? ` · ${formatINR(plan.lump)} one time` : ""}
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
      {plan.stillShortMonthly > 0 && <p className="text-xs text-warning">Some goals still need more. See plan details.</p>}
      <details className="group/plan border-t pt-3">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">
          <span>Review your plan{extraMonthly > 0 ? ` · ${sips.length} ${sips.length === 1 ? "change" : "changes"}` : ""}</span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open/plan:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-3 pt-3">
      {sips.length > 0 && <SipList sips={sips} />}
      {suggestions.some(s => s.lump > 0) && <div className="space-y-2 border-t pt-3 text-sm">
        <p className="font-medium">One-time investments</p>
        <ul className="space-y-2">{suggestions.filter(s => s.lump > 0).map(s => <li key={s.goalId} className="flex justify-between gap-3"><span className="min-w-0 break-words">{s.goalName}</span><span className="tabular shrink-0">{formatINR(s.lump)}</span></li>)}</ul>
      </div>}
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {plan.lump || plan.monthlyFree
            ? "Your goals don't need anything extra right now."
            : "Add savings or a monthly amount to get suggestions."}
        </p>
      ) : (
        <details className="border-t pt-3" open={sips.length === 0 || undefined}>
          <summary className="cursor-pointer py-1 text-sm font-medium text-primary">Plan details and options</summary>
          <div className="space-y-3 pt-3">
            <p className={`text-sm ${footer.tone}`}>{footer.text}</p>
            <p className="text-xs text-muted-foreground">Budget: {formatINR(plan.monthlyTotal)}/month. Current investments: {formatINR(plan.sipsNow)}/month. Suggested increase: {formatINR(extraMonthly)}/month.</p>
            <p className="text-xs text-muted-foreground">How the extra money supports your goals:</p>
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
        {sips.length > 0 && <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium">How to split the extra money</p>
          <div className="flex gap-2" role="group" aria-label="SIP strategy">
            {(["diversified", "simple"] as const).map((choice) => (
              <button key={choice} type="button" aria-pressed={strategy === choice}
                onClick={() => onStrategyChange(choice)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${strategy === choice ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground"}`}>
                {choice === "simple" ? "One holding per goal" : "Spread across holdings"}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Preview only. Your saved investments stay the same. Open a goal to record a change after you invest.</p>
        </div>}
          </div>
        </details>
      )}
        </div>
      </details>
      {form}
    </section>
  );
}
