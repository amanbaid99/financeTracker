"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoneyInput } from "./money-input";
import { useToast } from "./ui/toast";
import { Button } from "./ui/button";
import { hybridPlan, hybridVehicles } from "@/lib/hybrid-plan";
import { proposeGoalMapping } from "@/lib/hybrid-mapping";
import { goalSipDeadline } from "@/lib/goal-sip-policy";
import { confirmHybridPlan } from "@/lib/hybrid-actions";
import { formatINR, formatDate } from "@/lib/format";
import type { Investment, Link as GoalLink, TrackedGoal } from "@/lib/tracker";
export function SimpleSipPlanner({
  goals,
  investments,
  links: currentLinks,
  today,
  budgetMonthly,
  budgetConfigured,
  initialMonthly,
  monthlyEssentials,
  initialOverrides = {},
  revision,
  riskTolerance,
}: {
  goals: TrackedGoal[];
  investments: Investment[];
  links: GoalLink[];
  today: string;
  budgetMonthly: number;
  budgetConfigured: boolean;
  initialMonthly: number | null;
  monthlyEssentials: number | null;
  initialOverrides?: Record<string, number>;
  revision: string;
  riskTolerance: "conservative" | "moderate" | "aggressive" | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [monthly, setMonthly] = useState<number | null>(initialMonthly);
  const [essentials, setEssentials] = useState<number | null>(
    monthlyEssentials,
  );
  const [overrides, setOverrides] = useState(initialOverrides);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const valid =
    monthly !== null &&
    Number.isSafeInteger(monthly) &&
    monthly >= 0 &&
    monthly <= 1e9;
  const hasSafety = goals.some(
    (g) =>
      !g.completed &&
      (g.type === "emergency_fund" || (g.emergencyReserve ?? 0) > 0),
  );
  const costs = budgetConfigured ? (monthlyEssentials ?? 0) : (essentials ?? 0);
  const costsValid =
    Number.isSafeInteger(costs) &&
    costs >= 0 &&
    costs <= 1e9 &&
    (!hasSafety || monthly === 0 || budgetConfigured || essentials !== null);
  const overBudget = budgetConfigured && valid && monthly > budgetMonthly;
  const links = useMemo(
    () =>
      proposeGoalMapping(goals, investments, currentLinks, today, {
        refresh: false,
        riskTolerance,
      }),
    [goals, investments, currentLinks, today, riskTolerance],
  );
  const preview = useMemo(() => {
    if (!valid || !costsValid || overBudget) return null;
    try {
      const input = {
        goals,
        investments,
        links,
        today,
        riskTolerance,
        monthlySavings: budgetConfigured ? budgetMonthly : monthly!,
        monthlyPlanLimit: monthly!,
        allocationMode: "safety_deadline" as const,
        monthlyEssentials: costs,
        overrides,
        minimums: {},
      };
      const result = hybridPlan(input);
      result.vehicles = hybridVehicles(input, result);
      return { result, error: "" };
    } catch (e) {
      try {
        const fallback = hybridPlan({
          goals,
          investments,
          links,
          today,
          riskTolerance,
          monthlySavings: budgetConfigured ? budgetMonthly : monthly!,
          monthlyPlanLimit: monthly!,
          allocationMode: "safety_deadline",
          monthlyEssentials: costs,
        });
        fallback.vehicles = hybridVehicles(
          {
            goals,
            investments,
            links,
            today,
            monthlySavings: monthly!,
            allocationMode: "safety_deadline",
            monthlyEssentials: costs,
          },
          fallback,
        );
        return {
          result: fallback,
          error:
            e instanceof Error
              ? e.message
              : "Could not calculate. Review your amounts.",
        };
      } catch {
        return {
          result: null,
          error:
            e instanceof Error
              ? e.message
              : "Could not calculate. Review your amounts.",
        };
      }
    }
  }, [
    valid,
    costsValid,
    overBudget,
    goals,
    investments,
    links,
    today,
    riskTolerance,
    budgetConfigured,
    budgetMonthly,
    monthly,
    costs,
    overrides,
  ]);
  const result = preview?.result;
  const rows = result
    ? [...result.goals].sort(
        (a, b) =>
          Number(!!b.assumptions.runway) - Number(!!a.assumptions.runway) ||
          goalSipDeadline(
            goals.find((g) => g.id === a.goalId)!,
            today,
          ).localeCompare(
            goalSipDeadline(goals.find((g) => g.id === b.goalId)!, today),
          ) ||
          a.goalId.localeCompare(b.goalId),
      )
    : [];
  const safety = rows.filter((g) => g.assumptions.runway);
  const runway = safety.reduce(
    (n, g) => n + (g.assumptions.runway?.accessibleCorpus ?? 0),
    0,
  );
  function save() {
    if (!valid || !result || overBudget || preview?.error) return;
    setError("");
    start(async () => {
      try {
        const res = await confirmHybridPlan({
          calculatedOn: today,
          revision,
          monthly: monthly!,
          ...(!budgetConfigured ? { manualSavings: monthly! } : {}),
          allocationMode: "safety_deadline",
          monthlyEssentials: costs,
          lump: 0,
          cashBuffer: 0,
          refreshMapping: false,
          minimums: {},
          overrides,
        });
        if (!res.ok) return setError(res.error);
        toast({ text: "SIP plan saved." });
        router.replace("/goals");
        router.refresh();
      } catch {
        setError(
          "Connection interrupted. Reload to check whether the plan saved before retrying.",
        );
      }
    });
  }
  return (
    <div className="space-y-4">
      <section className="surface-card space-y-3 rounded-2xl border bg-card p-4">
        <label htmlFor="goal-sip-monthly" className="text-sm font-semibold">
          How much can you invest each month?
        </label>
        <MoneyInput
          id="goal-sip-monthly"
          aria-label="How much can you invest each month?"
          value={monthly}
          onChange={(v) => {
            setMonthly(v);
            setError("");
          }}
        />
        <p className="text-xs text-muted-foreground">
          Emergency cover first: one month, then three months. Next, payments
          and goals by nearest deadline. Amounts include any SIPs already
          running.
        </p>
        {budgetConfigured ? (
          <p className="text-xs text-muted-foreground">
            Available from Budget: {formatINR(budgetMonthly)}/mo.{" "}
            <Link className="text-primary" href="/goals/budget">
              Edit budget
            </Link>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Enter what is left after expenses and EMIs. This does not change
            your budget.
          </p>
        )}
        {hasSafety && !budgetConfigured && (
          <div className="space-y-2">
            <label htmlFor="goal-sip-costs" className="text-sm font-medium">
              Monthly essential costs and EMIs
            </label>
            <MoneyInput
              id="goal-sip-costs"
              aria-label="Monthly essential costs and EMIs"
              value={essentials}
              onChange={setEssentials}
            />
            <p className="text-xs text-muted-foreground">
              Used only to calculate how many months your emergency money
              covers.
            </p>
          </div>
        )}
        {overBudget && (
          <p role="alert" className="text-sm text-danger">
            This exceeds your saved budget. Lower it or update Budget.
          </p>
        )}
      </section>
      {result && (
        <>
          {safety.length > 0 && costs > 0 && (
            <section className="rounded-2xl border border-primary/20 bg-primary-soft p-4 text-sm">
              <p className="font-semibold">
                Emergency cover: {(runway / costs).toFixed(1)} months
              </p>
              <p className="mt-1 text-muted-foreground">
                {formatINR(runway)} saved. One month:{" "}
                {formatINR(
                  Math.min(
                    safety.reduce(
                      (n, g) => n + g.assumptions.runway!.oneMonthTarget,
                      0,
                    ),
                    costs,
                  ),
                )}
                . Three months:{" "}
                {formatINR(
                  Math.min(
                    safety.reduce(
                      (n, g) => n + g.assumptions.runway!.threeMonthTarget,
                      0,
                    ),
                    costs * 3,
                  ),
                )}
                .
              </p>
            </section>
          )}
          <section className="surface-card rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Your goals, in funding order</h2>
              {Object.keys(overrides).length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setOverrides({})}
                >
                  Reset amounts
                </Button>
              )}
            </div>
            {Object.keys(overrides).length > 0 && (
              <p className="mt-2 text-xs text-warning">
                Your edits take priority and may delay emergency cover or
                earlier goals.
              </p>
            )}
            <ul className="divide-y">
              {rows
                .filter(
                  (g) =>
                    g.status !== "fully_funded" ||
                    g.recommendedMonthly > 0 ||
                    !!g.assumptions.runway,
                )
                .map((g) => (
                  <li key={g.goalId} className="space-y-2 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{g.goalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {g.assumptions.runway
                            ? "Emergency cover and scheduled payments"
                            : g.targetDate
                              ? `Due ${formatDate(g.targetDate)}`
                              : "Add a deadline to plan this goal"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Object.hasOwn(overrides, g.goalId)
                            ? "Chosen by you"
                            : g.recommendedMonthly > 0
                              ? "Recommended this month"
                              : g.status === "fully_funded"
                                ? "Existing balance covers the target"
                                : "Waiting for earlier goals"}
                        </p>
                      </div>
                      <div className="w-28 shrink-0">
                        <MoneyInput
                          aria-label={`${g.goalName} a month`}
                          value={overrides[g.goalId] ?? g.recommendedMonthly}
                          onChange={(v) =>
                            setOverrides((old) => ({
                              ...old,
                              [g.goalId]: v ?? 0,
                            }))
                          }
                        />
                      </div>
                    </div>
                    {result.vehicles?.flatMap((v) =>
                      v.parts
                        .filter((p) => p.goalId === g.goalId && p.monthly > 0)
                        .map((p) => (
                          <div
                            key={v.key}
                            className="flex justify-between gap-3 text-sm text-muted-foreground"
                          >
                            <span className="min-w-0 break-words">
                              {v.label}
                            </span>
                            <span className="tabular shrink-0">
                              {formatINR(p.monthly)}
                            </span>
                          </div>
                        )),
                    )}
                    <details className="text-xs text-muted-foreground">
                      <summary className="min-h-9 cursor-pointer py-2 text-primary">
                        Plan details
                      </summary>
                      <dl className="space-y-1 pb-2">
                        {[
                          [
                            g.assumptions.runway
                              ? "Needed this month"
                              : "Needed each month",
                            g.requiredMonthly,
                          ],
                          ["Already saved", g.existingCoverage],
                          ["Monthly gap", g.monthlyShortfall],
                          ["Target at deadline", g.targetCorpus],
                          ["Projected at deadline", g.projectedCorpus],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="flex justify-between gap-3"
                          >
                            <dt>{label}</dt>
                            <dd className="tabular shrink-0">
                              {formatINR(value as number)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p>{g.explanation}</p>
                      <p className="mt-1">
                        Return {g.assumptions.annualReturnPct}% · Inflation{" "}
                        {g.assumptions.inflationPct}%. Future contributions are
                        projections.
                      </p>
                    </details>
                    {g.immediateShortfall > 0 && (
                      <p className="text-xs text-warning">
                        {formatINR(g.immediateShortfall)} is needed before the
                        next monthly contribution. A SIP cannot cover an
                        immediate payment.
                      </p>
                    )}
                    {g.assumptions.runway &&
                      g.warnings
                        .filter((w) => w.startsWith("Only accessible"))
                        .map((w) => (
                          <p key={w} className="text-xs text-warning">
                            {w}
                          </p>
                        ))}
                  </li>
                ))}
            </ul>
            <p className="border-t pt-3 text-sm">
              <strong>
                {formatINR(result.totalMonthlyAllocated)}/mo planned
              </strong>
              {monthly! - result.totalMonthlyAllocated > 0
                ? ` · ${formatINR(monthly! - result.totalMonthlyAllocated)} left unassigned`
                : ""}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Use at least ₹1,000 per selected vehicle where possible. A smaller
              amount stays in one. Only suitable holdings are selected; safety
              and lifestyle money stay separate. Review after emergency deposits
              are recorded so later contributions can move to the next goal.
            </p>
          </section>
        </>
      )}
      {(error || preview?.error) && (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft p-3 text-sm text-danger"
        >
          {error || preview?.error}{" "}
          <Button variant="ghost" size="sm" onClick={() => setOverrides({})}>
            Reset amounts
          </Button>
        </p>
      )}
      <Button
        className="w-full"
        disabled={
          pending || !valid || !result || overBudget || !!preview?.error
        }
        onClick={save}
      >
        {pending ? "Saving…" : "Save this plan"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Saving confirms a plan only. Set up SIPs with your provider. No money
        moves and no investment balance changes.
      </p>
    </div>
  );
}
