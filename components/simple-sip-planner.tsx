"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { confirmHybridPlan } from "@/lib/hybrid-actions";
import { proposeGoalMapping } from "@/lib/hybrid-mapping";
import {hybridPlan,hybridVehicles} from "@/lib/hybrid-plan";
import { sipSuggestions } from "@/lib/simple-sip";
import type { SipMinimums } from "@/lib/sip-minimums";
import { formatINR } from "@/lib/format";
import type { Investment, Link as GoalLink, TrackedGoal } from "@/lib/tracker";

/**
 * Your monthly SIPs as one list: every holding, with a suggested amount
 * (₹0 where nothing is suggested). Change any amount, then save.
 */
export function SimpleSipPlanner({
  goals,
  investments,
  links: currentLinks,
  today,
  budgetMonthly,
  essentialsMonthly = 0,
  savedAmounts,
  revision,
  riskTolerance,
}: {
  goals: TrackedGoal[];
  investments: Investment[];
  links: GoalLink[];
  today: string;
  /** The budget's Save & invest a month, 0 if none. */
  budgetMonthly: number;
  /** Fixed costs and EMIs a month, for the emergency fund floor. */
  essentialsMonthly?: number;
  /** Amounts saved last time, per holding (inv:<id>). */
  savedAmounts: SipMinimums;
  hasConfirmed: boolean;
  revision: string;
  riskTolerance?: "conservative" | "moderate" | "aggressive" | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const links = useMemo(
    () =>
      proposeGoalMapping(
        goals,
        investments,
        currentLinks,
        today,
        {
          refresh: false,
          riskTolerance,
        },
      ),
    [goals, investments, currentLinks, today, riskTolerance],
  );
  const s = useMemo(
    () =>
      sipSuggestions({
        goals,
        investments,
        links,
        today,
        budgetMonthly,
        essentialsMonthly,
        riskTolerance,
      }),
    [
      goals,
      investments,
      links,
      today,
      budgetMonthly,
      essentialsMonthly,
      riskTolerance,
    ],
  );
  const suggestedFor = (id: string) =>
    s.holdings.find((h) => h.investment.id === id)?.suggested ?? 0;
  const useSaved = Object.values(savedAmounts).some((v) => v > 0);
  const startAmounts = () =>
    Object.fromEntries(
      s.holdings.map((h) => [
        h.investment.id,
        useSaved ? (savedAmounts[`inv:${h.investment.id}`] ?? 0) : h.suggested,
      ]),
    );
  const [amounts, setAmounts] = useState<Record<string, number>>(startAmounts);
  const total = Object.values(amounts).reduce((a, b) => a + b, 0);
  const differsFromSuggested = s.holdings.some(
    (h) => (amounts[h.investment.id] ?? 0) !== h.suggested,
  );

  const overBudget = total > budgetMonthly;
  const preview = useMemo(()=>{
    if(total>budgetMonthly)return null;
    const input={goals,investments,links,today,riskTolerance,monthlySavings:budgetMonthly,monthlyPlanLimit:total,
      minimums:Object.fromEntries(Object.entries(amounts).map(([id,n])=>[`inv:${id}`,n]))};
    const result=hybridPlan(input);
    return {result,vehicles:hybridVehicles(input,result)};
  },[goals,investments,links,today,riskTolerance,budgetMonthly,total,amounts]);

  function save() {
    if (overBudget) return setError("Lower the amounts or update your budget before saving.");
    setError("");
    const minimums = Object.fromEntries(
      Object.entries(amounts)
        .filter(([, v]) => v > 0)
        .map(([id, v]) => [`inv:${id}`, v]),
    );
    start(async () => {
      const res = await confirmHybridPlan({
        calculatedOn: today,
        revision,
        monthly: total,
        lump: 0,
        cashBuffer: 0,
        refreshMapping: false,
        minimums,
        overrides: {},
      });
      if (!res.ok) return setError(res.error);
      router.replace("/goals/plan");
      router.refresh();
    });
  }

  return (
    <section aria-label="Monthly SIPs" className="space-y-4">
      <div className="surface-card space-y-1 rounded-2xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">Total a month</p>
        <p className="tabular text-3xl font-semibold tracking-tight">
          {formatINR(total)}
        </p>
        <p className="text-xs text-muted-foreground">
          The amounts you&apos;ve set below. Your goals need about{" "}
          {formatINR(s.goalsNeed)} a month.
        </p>
        {budgetMonthly === 0 && <p className="mt-2 text-sm text-muted-foreground">No monthly savings available yet. <Link href="/goals/budget" className="font-medium text-primary">Update your budget</Link> to plan new contributions. Existing investments still cover your goals.</p>}
        <p className="text-sm text-muted-foreground">Available from your budget: {formatINR(budgetMonthly)}/mo</p>
        {!overBudget&&total<budgetMonthly&&<p className="text-xs text-muted-foreground">{formatINR(budgetMonthly-total)} remains unassigned. You don&apos;t have to invest it all.</p>}
        {overBudget && (
          <p className="text-xs text-warning">
            {formatINR(total - budgetMonthly)} more than your budget sets aside.
          </p>
        )}
      </div>

      {s.byGoal.some((l) => l.monthly > 0) && (
        <details className="surface-card rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer font-semibold">
            Why these amounts
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Essential goals first, then other goals based on their priority,
            deadline and remaining need. The same rules calculate your saved plan.
          </p>
          <ul className="mt-2 divide-y">
            {s.byGoal.map((l) => (
              <li
                key={l.goalId}
                className="flex items-start justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{l.goalName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {l.why}
                  </span>
                </span>
                <span className="tabular shrink-0">{formatINR(l.monthly)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="surface-card rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Your holdings</h2>
          {differsFromSuggested && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setAmounts(
                  Object.fromEntries(
                    s.holdings.map((h) => [h.investment.id, h.suggested]),
                  ),
                )
              }
            >
              Use suggestions
            </Button>
          )}
        </div>
        {s.holdings.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            No holdings yet. Add your funds and accounts in Net worth.
          </p>
        ) : (
          <ul className="divide-y">
            {s.holdings.map((h) => {
              const id = h.investment.id;
              const suggested = suggestedFor(id);
              return (
                <li key={id} className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">
                        {h.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {h.kindLabel}
                        {h.investment.monthlySip > 0
                          ? ` · now ${formatINR(h.investment.monthlySip)}/mo`
                          : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {suggested > 0
                          ? `Suggested ${formatINR(suggested)}${h.covers.length ? ` for ${h.covers.join(", ")}` : ""}`
                          : "Nothing suggested"}
                      </p>
                    </div>
                    <div className="w-28 shrink-0">
                      <MoneyInput
                        aria-label={`${h.label} a month`}
                        value={amounts[id] ?? 0}
                        onChange={(v) =>
                          setAmounts((a) => ({ ...a, [id]: v ?? 0 }))
                        }
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {s.newFunds.length > 0 && (
        <div className="surface-card space-y-2 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">
            Suggested, but you don&apos;t hold one
          </h2>
          <ul className="divide-y">
            {s.newFunds.map((f) => (
              <li
                key={f.key}
                className="flex items-start justify-between gap-3 py-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{f.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatINR(f.suggested)} a month
                    {f.covers.length ? ` for ${f.covers.join(", ")}` : ""}
                  </span>
                </span>
                <Link
                  href={`/assets?do=add&category=${encodeURIComponent(f.category)}`}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1 text-sm text-primary"
                >
                  <Plus className="size-3.5" aria-hidden /> Add one
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Once you add it, it shows in the list above.
          </p>
        </div>
      )}

      {preview&&differsFromSuggested&&<p className="rounded-xl bg-muted/50 p-3 text-sm">With these amounts, your goals still need about {formatINR(preview.result.monthlyContributionShortfall)} more a month.{preview.result.goals.some(g=>g.category==="essential"&&g.monthlyShortfall>0)?" Some essential goals remain short.":""}</p>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button className="w-full" disabled={pending || overBudget} onClick={save}>
        {pending ? "Saving…" : "Save this plan"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Saving keeps this plan in the app. No SIP is started or changed with
        your provider.
      </p>
    </section>
  );
}
