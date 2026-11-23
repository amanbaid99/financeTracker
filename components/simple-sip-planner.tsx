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
  type VehicleOverrides,
  type WorksheetVehicle,
} from "@/lib/sip-worksheet";
import { proposeGoalMapping } from "@/lib/hybrid-mapping";
import { confirmHybridPlan } from "@/lib/hybrid-actions";
import { formatINR, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";
export function SimpleSipPlanner({
  goals,
  investments,
  links: currentLinks,
  today,
  initialMonthly,
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
  initialOverrides?: Record<string, number>;
  initialVehicleOverrides?: VehicleOverrides;
  revision: string;
  riskTolerance: "conservative" | "moderate" | "aggressive" | null;
}) {
  const router = useRouter(),
    toast = useToast();
  const [monthly, setMonthly] = useState(initialMonthly);
  const [overrides, setOverrides] = useState(initialOverrides);
  const [vehicleOverrides, setVehicleOverrides] = useState(
    initialVehicleOverrides,
  );
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const valid =
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
    () => ({ monthly, overrides, vehicleOverrides }),
    [monthly, overrides, vehicleOverrides],
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
      monthlyEssentials: 0,
      includeAlternatives: false,
      allocationMode: "safety_deadline" as const,
    }),
    [goals, investments, links, today, riskTolerance, deferred.monthly],
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
  const edited =
    Object.keys(overrides).length > 0 ||
    Object.keys(vehicleOverrides).length > 0;
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
    setOverrides((old) => ({
      ...old,
      [id]: Math.max(0, goalTotal + amount - current),
    }));
    if (row.held)
      setVehicleOverrides((old) => ({
        ...old,
        [id]: { ...old[id], [row.key]: amount },
      }));
    else
      setVehicleOverrides((old) => {
        const next = { ...old };
        delete next[id];
        return next;
      });
  }
  function restoreGoal(id: string) {
    setError("");
    setOverrides((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
    setVehicleOverrides((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
  }
  function restoreVehicle(id: string, key: string) {
    setError("");
    setOverrides((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
    setVehicleOverrides((old) => {
      const next = { ...old, [id]: { ...old[id] } };
      delete next[id][key];
      if (!Object.keys(next[id]).length) delete next[id];
      return next;
    });
  }
  function reset() {
    setError("");
    setOverrides({});
    setVehicleOverrides({});
  }
  function save() {
    if (!valid || !result || preview?.error || recalculating) return;
    setError("");
    start(async () => {
      try {
        const res = await confirmHybridPlan({
          calculatedOn: today,
          revision,
          monthly: monthly!,
          manualSavings: monthly!,
          allocationMode: "safety_deadline",
          monthlyEssentials: 0,
          lump: 0,
          cashBuffer: 0,
          refreshMapping: false,
          minimums: {},
          overrides,
          vehicleOverrides,
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
        <p className="text-xs text-muted-foreground">
          Set a total. Adjust a vehicle below; its goal total and the rest
          recalculate. Budget stays separate.
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
            {edited && (
              <button
                type="button"
                onClick={reset}
                className="min-h-10 text-xs text-primary underline decoration-dotted underline-offset-4"
              >
                Reset amounts
              </button>
            )}
          </div>
          <div className="space-y-4">
            {ordered
              .filter((g) => !goals.find((x) => x.id === g.goalId)?.completed)
              .map((g) => {
                const dated = !g.needsDate;
                const met =
                  g.projectedShortfall === 0 && g.immediateShortfall === 0;
                const tone =
                  recalculating || preview?.error
                    ? "neutral"
                    : !dated
                      ? "neutral"
                      : met
                        ? "success"
                        : "danger";
                const baseline = sheet.baseline.goals.find(
                  (x) => x.goalId === g.goalId,
                )!;
                const raw = overrides[g.goalId] ?? g.recommendedMonthly;
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
                              : g.targetDate
                                ? `Due ${formatDate(g.targetDate)}`
                                : "No target date"}
                          </p>
                        </div>
                        <div className="w-32 shrink-0">
                          <p className="mb-1 text-right text-xs text-muted-foreground">
                            Monthly total
                          </p>
                          <p
                            className="tabular break-words text-right text-xl font-semibold"
                            aria-label={`${g.goalName} monthly total`}
                          >
                            {formatINR(raw)}
                          </p>
                          {(Object.hasOwn(overrides, g.goalId) ||
                            Object.keys(vehicleOverrides[g.goalId] ?? {})
                              .length > 0) && (
                            <button
                              type="button"
                              onClick={() => restoreGoal(g.goalId)}
                              className="min-h-9 w-full text-right text-xs text-primary underline decoration-dotted underline-offset-4"
                            >
                              Use suggested amount
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap justify-between gap-2 text-xs">
                          <span
                            className={cn(
                              "font-medium",
                              tone === "success"
                                ? "text-success"
                                : tone === "danger"
                                  ? "text-danger"
                                  : "text-muted-foreground",
                            )}
                          >
                            {preview?.error
                              ? "Review amounts to update projections"
                              : !dated
                                ? "Add a date to check progress"
                                : met
                                  ? g.status === "fully_funded"
                                    ? "Already funded"
                                    : "Projected to meet goal"
                                  : `${formatINR(g.projectedShortfall)} projected shortfall`}
                          </span>
                          <span className="text-muted-foreground">
                            {!recalculating &&
                              !preview?.error &&
                              `${g.targetCorpus > 0 ? Math.min(100, Math.round((g.projectedCorpus / g.targetCorpus) * 100)) : 100}% projected`}
                          </span>
                        </div>
                        <Progress
                          value={
                            preview?.error
                              ? 0
                              : g.targetCorpus > 0
                                ? (g.projectedCorpus / g.targetCorpus) * 100
                                : 100
                          }
                          tone={tone}
                          label={`${g.goalName} projected funding`}
                        />
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
                            <p className="mt-1 text-xs text-muted-foreground">
                              {v.held
                                ? Object.hasOwn(
                                    vehicleOverrides[g.goalId] ?? {},
                                    v.key,
                                  )
                                  ? "Chosen by you"
                                  : "Your holding"
                                : "Suggested investment type"}
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
                            {Object.hasOwn(
                              vehicleOverrides[g.goalId] ?? {},
                              v.key,
                            ) && (
                              <button
                                type="button"
                                onClick={() => restoreVehicle(g.goalId, v.key)}
                                className="min-h-9 w-full text-right text-xs text-primary underline decoration-dotted underline-offset-4"
                              >
                                Use suggestion
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <details className="border-t px-4 text-xs text-muted-foreground">
                      <summary className="min-h-10 cursor-pointer py-3">
                        Plan details
                      </summary>
                      <dl className="space-y-1">
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
                          [
                            "Suggested monthly amount",
                            baseline.recommendedMonthly,
                          ],
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
                      <p className="mt-2">{g.explanation}</p>
                      <p className="mb-3 mt-1">
                        Return {g.assumptions.annualReturnPct}% · Inflation{" "}
                        {g.assumptions.inflationPct}%. These are projections.
                      </p>
                      {g.immediateShortfall > 0 && (
                        <p className="pb-3 text-warning">
                          {formatINR(g.immediateShortfall)} is needed before the
                          next monthly contribution.
                        </p>
                      )}
                    </details>
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
          <button
            type="button"
            onClick={reset}
            className="ml-2 min-h-10 underline decoration-dotted underline-offset-4"
          >
            Use suggestions
          </button>
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
        Green and red show projected funding, not guaranteed returns.
      </p>
    </div>
  );
}
