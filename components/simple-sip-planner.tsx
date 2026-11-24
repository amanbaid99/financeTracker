"use client";
import { useMemo, useState, useTransition, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import { MoneyInput } from "./money-input";
import { useToast } from "./ui/toast";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { GoalIcon } from "./goal-icon";
import {
  sipWorksheet,
  sipWorksheetBaseline,
  sipVehicleEdit,
  type VehicleOverrides,
  type WorksheetVehicle,
} from "@/lib/sip-worksheet";
import { goalFirstCandidates } from "@/lib/sip-plan";
import { proposeGoalMapping } from "@/lib/hybrid-mapping";
import { confirmHybridPlan } from "@/lib/hybrid-actions";
import { formatINR, formatDate } from "@/lib/format";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";
export function SimpleSipPlanner({
  goals,
  investments,
  links: currentLinks,
  today,
  initialMonthly,
  budgetMonthly,
  essentialsMonthly = 0,
  initialStartMonth,
  initialOverrides = {},
  initialVehicleOverrides = {},
  revision,
  riskTolerance,
}: {
  goals: TrackedGoal[];
  investments: Investment[];
  links: Link[];
  today: string;
  initialMonthly: number | null;
  budgetMonthly?: number | null;
  /** Fixed costs a month from the budget, for the emergency fund's pace. */
  essentialsMonthly?: number;
  initialStartMonth?: string;
  initialOverrides?: Record<string, number>;
  initialVehicleOverrides?: VehicleOverrides;
  revision: string;
  riskTolerance: "conservative" | "moderate" | "aggressive" | null;
}) {
  const router = useRouter(),
    toast = useToast();
  const [monthly, setMonthly] = useState(initialMonthly);
  const [startMonth, setStartMonth] = useState(initialStartMonth ?? today.slice(0,7));
  const [overrides, setOverrides] = useState(initialOverrides);
  const [vehicleOverrides, setVehicleOverrides] = useState(
    initialVehicleOverrides,
  );
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const valid =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth) &&
    monthly !== null &&
    Number.isSafeInteger(monthly) &&
    monthly >= 0 &&
    monthly <= 1e9;
  const links = useMemo(
    () =>
      proposeGoalMapping(goals, investments, currentLinks, today, {
        refresh: false,
        riskTolerance,
      }),
    [goals, investments, currentLinks, today, riskTolerance],
  );
  const edits = useMemo(
    () => ({ monthly, overrides, vehicleOverrides, startMonth }),
    [monthly, overrides, vehicleOverrides, startMonth],
  );
  const deferred = useDeferredValue(edits);
  const recalculating = deferred !== edits;
  const calculationInput = useMemo(
    () => ({
      goals,
      investments,
      links,
      today,
      riskTolerance,
      monthlySavings: deferred.monthly ?? 0,
      monthlyPlanLimit: deferred.monthly ?? 0,
      monthlyEssentials: essentialsMonthly,
      contributionStartMonth: deferred.startMonth,
      includeAlternatives: false,
      allocationMode: "safety_deadline" as const,
    }),
    [goals, investments, links, today, riskTolerance, deferred.monthly, deferred.startMonth, essentialsMonthly],
  );
  const recommendation = useMemo(() => {
    if (
      deferred.monthly === null ||
      !Number.isSafeInteger(deferred.monthly) ||
      deferred.monthly < 0 ||
      deferred.monthly > 1e9
    )
      return null;
    try {
      return { baseline: sipWorksheetBaseline(calculationInput), error: "" };
    } catch (e) {
      return {
        baseline: null,
        error:
          e instanceof Error ? e.message : "Could not calculate this plan.",
      };
    }
  }, [calculationInput, deferred.monthly]);
  const preview = useMemo(() => {
    if (!recommendation) return null;
    if (!recommendation.baseline)
      return { sheet: null, error: recommendation.error };
    const input = {
      ...calculationInput,
      overrides: deferred.overrides,
      vehicleOverrides: deferred.vehicleOverrides,
    };
    try {
      return { sheet: sipWorksheet(input, recommendation.baseline), error: "" };
    } catch (e) {
      try {
        return {
          sheet: sipWorksheet(
            { ...input, overrides: {}, vehicleOverrides: {} },
            recommendation.baseline,
          ),
          error: e instanceof Error ? e.message : "Review your amounts.",
        };
      } catch {
        return {
          sheet: null,
          error:
            e instanceof Error ? e.message : "Could not calculate this plan.",
        };
      }
    }
  }, [
    recommendation,
    calculationInput,
    deferred.overrides,
    deferred.vehicleOverrides,
  ]);
  const sheet = preview?.sheet,
    result = sheet?.result;
  const ordered = result
    ? [...result.goals].sort(
        (a, b) =>
          (result.fundingOrder?.indexOf(a.goalId) ?? 0) -
          (result.fundingOrder?.indexOf(b.goalId) ?? 0),
      )
    : [];
  function changeVehicle(
    id: string,
    row: WorksheetVehicle,
    value: number | null,
  ) {
    const amount = value ?? 0;
    const current = vehicleOverrides[id]?.[row.key] ?? row.amount;
    const goalTotal =
      overrides[id] ??
      result?.goals.find((g) => g.goalId === id)?.recommendedMonthly ??
      0;
    setError("");
    const next = sipVehicleEdit(
      id, row.key, amount, current, goalTotal, vehicleOverrides, row.held,
      goalFirstCandidates(id, result?.goals.find(g => g.goalId === id)?.investmentCategory ?? "", Math.max(goalTotal, 1000), investments.filter(i => `inv:${i.id}` !== row.key && !Object.hasOwn(vehicleOverrides[id] ?? {}, `inv:${i.id}`)), links, goals.find(g => g.id === id)).length > 0,
    );
    setOverrides(next.overrides);
    setVehicleOverrides(next.vehicleOverrides);
  }
  function save() {
    if (!valid || !result || preview?.error || recalculating) return;
    setError("");
    start(async () => {
      try {
        const res = await confirmHybridPlan({
          calculatedOn: today,
          contributionStartMonth: startMonth,
          revision,
          monthly: monthly!,
          manualSavings: monthly!,
          allocationMode: "safety_deadline",
          monthlyEssentials: essentialsMonthly,
          lump: 0,
          cashBuffer: 0,
          refreshMapping: false,
          minimums: {},
          overrides,
          vehicleOverrides,
        });
        if (!res.ok) return setError(res.error);
        toast({ text: "SIP plan saved." });
        router.replace("/goals/budget");
        router.refresh();
      } catch {
        setError(
          "Connection interrupted. Reload to check whether the plan saved before retrying.",
        );
      }
    });
  }
  return (
    <div className="space-y-5" data-sip-calculating={recalculating}>
      <section className="surface-card overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/5 via-card to-card p-5 sm:p-6">
        <label
          htmlFor="goal-sip-monthly"
          className="text-sm font-medium text-muted-foreground"
        >
          Your monthly SIP amount
        </label>
        <MoneyInput
          id="goal-sip-monthly"
          aria-label="How much can you invest each month?"
          value={monthly}
          onChange={(v) => {
            setMonthly(v);
            setError("");
          }}
          className="[&_input]:h-20 [&_input]:rounded-none [&_input]:border-0 [&_input]:bg-transparent [&_input]:pl-9 [&_input]:pr-0 [&_input]:text-4xl [&_input]:font-semibold [&_span]:left-0 [&_span]:text-3xl sm:[&_input]:text-5xl"
        />
        {budgetMonthly != null && <p className="mt-2 text-xs text-muted-foreground">Save &amp; invest budget: {formatINR(budgetMonthly)} / month. Saving confirms this SIP plan only.</p>}
        <div className="my-4 space-y-1.5">
          <label htmlFor="sip-start-month" className="text-sm font-medium">Start contributions from</label>
          <Input id="sip-start-month" type="month" value={startMonth} onChange={e => {setStartMonth(e.target.value);setError("");}} />
          <p className="text-xs text-muted-foreground">Projections use full monthly periods and no contributions before this month. Saved amounts only change when you confirm.</p>
          {result?.goals.some(g => g.months !== null && g.months <= (g.assumptions.skippedContributionMonths ?? 0) && g.projectedShortfall > 0) && <p role="alert" className="text-sm text-warning">Some goals are due before contributions can start. They need existing money or an earlier start.</p>}
        </div>
        <p className="text-xs text-muted-foreground">
          Goals fill in priority order. Vehicle edits use the lowest-priority
          automatic money first.
        </p>
        {result && !preview?.error && (
          <div className="mt-4 flex min-h-9 flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm">
            {recalculating ? (
              <span className="text-muted-foreground" role="status">
                Updating allocations…
              </span>
            ) : (
              <>
                {" "}
                <span>
                  <b className="tabular">
                    {formatINR(result.totalMonthlyAllocated)}
                  </b>{" "}
                  allocated
                </span>
                <span className="text-muted-foreground">
                  <b className="tabular">
                    {formatINR(
                      Math.max(0, monthly! - result.totalMonthlyAllocated),
                    )}
                  </b>{" "}
                  left
                </span>
              </>
            )}
          </div>
        )}
      </section>
      {sheet && (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Your goals, in funding order</h2>

          </div>
          <div className="space-y-4">
            {ordered
              .filter((g) => !goals.find((x) => x.id === g.goalId)?.completed)
              .map((g) => {
                const raw = overrides[g.goalId] ?? g.recommendedMonthly;
                const met = raw >= g.requiredMonthly;
                const tone = preview?.error ? "neutral" : met ? "success" : "danger";
                const vehicles = sheet.rows[g.goalId] ?? [];
                const name = goals.find((x) => x.id === g.goalId)!;
                return (
                  <section
                    key={g.goalId}
                    data-goal-id={g.goalId}
                    data-funding-status={tone}
                    className={cn(
                      "surface-card overflow-hidden rounded-2xl border bg-card",
                      tone === "success"
                        ? "border-success/30"
                        : tone === "danger"
                          ? "border-danger/25"
                          : "border-border",
                    )}
                  >
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-2 flex items-center gap-2">
                            <GoalIcon
                              type={name.type}
                              className="size-5 shrink-0 text-primary"
                            />
                            <h3 className="break-words font-semibold">
                              {g.goalName}
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {g.assumptions.runway
                              ? "Emergency cover and scheduled payments"
                              : name.type === "bills_fund"
                                ? "Scheduled payments"
                                : g.targetDate
                                ? `Due ${formatDate(g.targetDate)}`
                                : "No target date"}
                          </p>
                        </div>

                      </div>
                      <div className="space-y-1.5">
                        <p className="tabular text-sm font-medium" aria-label={`${g.goalName} monthly total`}>{formatINR(raw)} / month allocated</p>
                        <Progress value={preview?.error ? 0 : g.requiredMonthly > 0 ? (raw / g.requiredMonthly) * 100 : 100} tone={tone} label={`${g.goalName} monthly allocation`} />
                        <div className="flex justify-between gap-3 text-xs text-muted-foreground"><span>₹0</span><span className="tabular text-right">{formatINR(g.requiredMonthly)} / month required</span></div>
                      </div>
                    </div>
                    <div className="divide-y border-t px-4">
                      {vehicles.map((v) => (
                        <div
                          key={v.key}
                          className="flex items-start justify-between gap-3 py-3"
                        >
                          <div className="min-w-0 py-1">
                            <p className="break-words text-sm font-medium">
                              {v.label}
                            </p>

                          </div>
                          <div className="w-28 shrink-0">
                            <MoneyInput
                              aria-label={`${v.label} for ${g.goalName} a month`}
                              value={
                                vehicleOverrides[g.goalId]?.[v.key] ?? v.amount
                              }
                              onChange={(n) => changeVehicle(g.goalId, v, n)}
                            />

                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
          </div>
        </>
      )}
      {(error || (!recalculating && preview?.error)) && (
        <div
          role="alert"
          className="rounded-xl bg-danger-soft p-3 text-sm text-danger"
        >
          {error || preview?.error}

        </div>
      )}
      <Button
        className="w-full"
        disabled={
          pending || recalculating || !valid || !result || !!preview?.error
        }
        onClick={save}
      >
        {pending
          ? "Saving…"
          : recalculating
            ? "Updating amounts…"
            : "Save this plan"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Saving confirms a plan only. No money moves or provider SIPs change.
        The bar shows monthly allocation, not investment returns.
      </p>
    </div>
  );
}
