"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { confirmHybridPlan } from "@/lib/hybrid-actions";
import { proposeGoalMapping } from "@/lib/hybrid-mapping";
import { hybridPlan, hybridVehicles } from "@/lib/hybrid-plan";
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
  budgetConfigured = true,
  initialMonthly,
  essentialsMonthly = 0,
  savedAmounts,
  savedExactHoldings = false,
  revision,
  riskTolerance,
}: {
  goals: TrackedGoal[];
  investments: Investment[];
  links: GoalLink[];
  today: string;
  /** The budget's Save & invest a month, 0 if none. */
  budgetMonthly: number;
  budgetConfigured?: boolean;
  initialMonthly?: number | null;
  /** Fixed costs and EMIs a month, for the emergency fund floor. */
  essentialsMonthly?: number;
  /** Amounts saved last time, per holding (inv:<id>). */
  savedAmounts: SipMinimums;
  savedExactHoldings?: boolean;
  hasConfirmed: boolean;
  revision: string;
  riskTolerance?: "conservative" | "moderate" | "aggressive" | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [monthly, setMonthly] = useState<number | null>(
    initialMonthly === undefined
      ? budgetConfigured
        ? budgetMonthly
        : null
      : initialMonthly,
  );
  const validMonthly =
    monthly !== null &&
    Number.isSafeInteger(monthly) &&
    monthly >= 0 &&
    monthly <= 1e9;
  const monthlyLimit = validMonthly ? monthly : 0;
  const capacity = budgetConfigured ? budgetMonthly : monthlyLimit;
  const links = useMemo(
    () =>
      proposeGoalMapping(goals, investments, currentLinks, today, {
        refresh: false,
        riskTolerance,
      }),
    [goals, investments, currentLinks, today, riskTolerance],
  );
  const baseline = useMemo(
    () =>
      sipSuggestions({
        goals,
        investments,
        links,
        today,
        budgetMonthly: monthlyLimit,
        essentialsMonthly,
        riskTolerance,
      }),
    [
      goals,
      investments,
      links,
      today,
      monthlyLimit,
      essentialsMonthly,
      riskTolerance,
    ],
  );
  const [fixed, setFixed] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      baseline.holdings.flatMap((h) => {
        const value = savedAmounts[`inv:${h.investment.id}`];
        return value !== undefined &&
          (savedExactHoldings || value !== h.suggested)
          ? [[h.investment.id, value]]
          : [];
      }),
    ),
  );
  const fixedTotal = Object.values(fixed).reduce((sum, n) => sum + n, 0);
  const s = useMemo(
    () =>
      sipSuggestions({
        goals,
        investments,
        links,
        today,
        budgetMonthly: fixedTotal > monthlyLimit ? 0 : monthlyLimit,
        essentialsMonthly,
        riskTolerance,
        minimums:
          fixedTotal > monthlyLimit
            ? {}
            : Object.fromEntries(
                Object.entries(fixed).map(([id, n]) => [`inv:${id}`, n]),
              ),
        exactHoldings: true,
      }),
    [
      goals,
      investments,
      links,
      today,
      monthlyLimit,
      essentialsMonthly,
      riskTolerance,
      fixed,
      fixedTotal,
    ],
  );
  const displayHoldings = baseline.holdings.map(
    (h) => s.holdings.find((l) => l.investment.id === h.investment.id) ?? h,
  );
  const amounts = Object.fromEntries(
    s.holdings.map((h) => [
      h.investment.id,
      fixed[h.investment.id] ?? h.suggested,
    ]),
  );
  const total = Object.values(amounts).reduce((sum, n) => sum + n, 0);
  const differsFromSuggested = Object.keys(fixed).length > 0;
  const suggestedFor = (id: string) =>
    s.holdings.find((h) => h.investment.id === id)?.suggested ?? 0;
  const overBudget =
    fixedTotal > monthlyLimit ||
    total > monthlyLimit ||
    (budgetConfigured && monthlyLimit > budgetMonthly);
  function changeMonthly(value: number | null) {
    setMonthly(value);
    setError("");
  }
  const preview = useMemo(() => {
    if (total > monthlyLimit || !validMonthly) return null;
    const input = {
      goals,
      investments,
      links,
      today,
      riskTolerance,
      monthlySavings: capacity,
      monthlyPlanLimit: monthlyLimit,
      exactHoldings: true,
      minimums: Object.fromEntries(
        Object.entries(fixed).map(([id, n]) => [`inv:${id}`, n]),
      ),
    };
    try {
      const result = hybridPlan(input);
      return { result, vehicles: hybridVehicles(input, result), error: "" };
    } catch (error) {
      return {
        result: null,
        vehicles: [],
        error:
          error instanceof Error
            ? error.message
            : "Could not calculate this plan. Review the amounts.",
      };
    }
  }, [
    goals,
    investments,
    links,
    today,
    riskTolerance,
    capacity,
    monthlyLimit,
    validMonthly,
    total,
    fixed,
  ]);

  function save() {
    if (!validMonthly) return setError("Enter a valid monthly amount first.");
    if (preview?.error) return setError(preview.error);
    if (overBudget)
      return setError("Lower the amounts or update your budget before saving.");
    setError("");
    const minimums = Object.fromEntries(
      Object.entries(fixed).map(([id, v]) => [`inv:${id}`, v]),
    );
    start(async () => {
      try {
        const res = await confirmHybridPlan({
          calculatedOn: today,
          revision,
          monthly: monthlyLimit,
          exactHoldings: true,
          ...(!budgetConfigured ? { manualSavings: monthlyLimit } : {}),
          lump: 0,
          cashBuffer: 0,
          refreshMapping: false,
          minimums,
          overrides: {},
        });
        if (!res.ok) return setError(res.error);
        router.replace("/goals/plan");
        router.refresh();
      } catch {
        setError(
          "Connection interrupted. Reload the planner to check whether the plan saved before retrying.",
        );
      }
    });
  }

  return (
    <section aria-label="Monthly SIPs" className="space-y-4">
      <div className="surface-card space-y-1 rounded-2xl border bg-card p-4">
        <label
          htmlFor="sip-monthly-budget"
          className="block text-sm font-semibold"
        >
          How much can you invest each month?
        </label>
        <MoneyInput
          id="sip-monthly-budget"
          value={monthly}
          onChange={changeMonthly}
        />
        <p className="pt-1 text-xs text-muted-foreground">
          {budgetConfigured
            ? `Your budget allows ${formatINR(budgetMonthly)}/mo.`
            : "No budget is saved. Enter what you can set aside after expenses and EMIs. You can create a budget later."}{" "}
          Your chosen holding amounts stay fixed. Other suggestions update
          automatically.
        </p>
        {monthly !== null && !validMonthly && (
          <p role="alert" className="text-sm text-danger">
            Enter a whole-rupee monthly amount up to {formatINR(1e9)}.
          </p>
        )}
        {monthly === null && (
          <p className="pt-2 text-sm text-muted-foreground">
            Enter your monthly amount to see where it could go.
          </p>
        )}
        {monthly !== null && (
          <p className="pt-2 text-sm text-muted-foreground">
            {formatINR(total)} assigned to your holdings
            {monthlyLimit > total
              ? ` · ${formatINR(monthlyLimit - total)} not assigned yet`
              : ""}
            .
          </p>
        )}
        {overBudget && (
          <p role="alert" className="pt-2 text-sm text-danger">
            {budgetConfigured && monthlyLimit > budgetMonthly
              ? "This exceeds your budget. Lower the amount or update Budget."
              : "Your holding amounts exceed the monthly amount above."}
          </p>
        )}
        {budgetConfigured && monthlyLimit > budgetMonthly && (
          <Link
            href="/goals/budget"
            className="inline-flex min-h-10 items-center text-sm text-primary"
          >
            Edit budget
          </Link>
        )}
      </div>

      {monthlyLimit > 0 && (
        <>
          {s.byGoal.some((l) => l.monthly > 0) && (
            <details className="surface-card rounded-2xl border bg-card p-4">
              <summary className="cursor-pointer font-semibold">
                Why these amounts
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">
                Essential goals first, then other goals based on their priority,
                deadline and remaining need. The same rules calculate your saved
                plan.
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
                    <span className="tabular shrink-0">
                      {formatINR(l.monthly)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="surface-card rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Your holdings</h2>
              {differsFromSuggested && (
                <Button variant="ghost" size="sm" onClick={() => setFixed({})}>
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
                {displayHoldings.map((h) => {
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
                            {Object.hasOwn(fixed, id)
                              ? "Chosen by you"
                              : suggested > 0
                                ? `Suggested ${formatINR(suggested)}${h.covers.length ? ` for ${h.covers.join(", ")}` : ""}`
                                : "Nothing suggested"}
                          </p>
                        </div>
                        <div className="w-28 shrink-0">
                          <MoneyInput
                            aria-label={`${h.label} a month`}
                            value={amounts[id] ?? 0}
                            onChange={(v) =>
                              setFixed((a) => ({ ...a, [id]: v ?? 0 }))
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
        </>
      )}
      {preview?.result && differsFromSuggested && (
        <p className="rounded-xl bg-muted/50 p-3 text-sm">
          With these amounts, your goals still need about{" "}
          {formatINR(preview.result.monthlyContributionShortfall)} more a month.
          {preview.result.goals.some(
            (g) => g.category === "essential" && g.monthlyShortfall > 0,
          )
            ? " Some essential goals remain short."
            : ""}
        </p>
      )}
      {preview?.error && (
        <p role="alert" className="text-sm text-danger">
          {preview.error}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {error && (
        <Button variant="outline" onClick={() => router.refresh()}>
          Reload planner
        </Button>
      )}
      <Button
        className="w-full"
        disabled={pending || !validMonthly || overBudget || !!preview?.error}
        onClick={save}
      >
        {pending ? "Saving…" : "Save this plan"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Saving keeps this plan in the app. No SIP is started or changed with
        your provider.
      </p>
    </section>
  );
}
