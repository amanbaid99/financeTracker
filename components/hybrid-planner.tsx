"use client";
import {todayIST} from "@/lib/dates";
import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoneyInput } from "./money-input";
import { Field } from "./forms/field";
import { Button } from "./ui/button";
import { InvestmentVehicles } from "./investment-vehicles";
import { Progress } from "./ui/progress";
import { formatINR, formatDate,formatINRCompact } from "@/lib/format";
import {
  hybridPlan,
  hybridVehicles,
  type HybridPlanInput,
} from "@/lib/hybrid-plan";
import { proposeGoalMapping } from "@/lib/hybrid-mapping";
import { heldSipHoldings, type SipMinimums } from "@/lib/sip-minimums";
import { confirmHybridPlan } from "@/lib/hybrid-actions";
import { unallocatedLiquidValue, type HybridResult } from "@/lib/hybrid-engine";
import type { Investment, Link as GoalLink, TrackedGoal } from "@/lib/tracker";
export interface HybridPlannerProps {
  riskTolerance?: "conservative" | "moderate" | "aggressive" | null;
  initialMonthly: number | null;
  savedMonthly?: number | null;
  goals: TrackedGoal[];
  investments: Investment[];
  links: GoalLink[];
  today: string;
  lump: number;
  essentialsMonthly: number;
  initialMinimums?: SipMinimums;
  revision?: string;
  confirmed?: {
    createdAt: string;
    result: HybridResult;
    inputs: unknown;
    stale: boolean;
  } | null;
  history?: { id: string; createdAt: string; result: HybridResult }[];
  mode?: "create" | "view";
  budgetDeficit?: number;
}
const LABEL = {
  fully_funded: "Fully funded",
  on_track: "On track",
  at_risk: "At risk",
  underfunded: "Underfunded",
};
export function HybridPlanner(props: HybridPlannerProps) {
  const {
    goals,
    investments,
    today,
    initialMonthly,
    revision,
    confirmed,
    history = [],
    mode = "create",
  } = props;
  const prior = confirmed?.inputs as
    | {
        overrides?: Record<string, number>;
        cashBuffer?: number;
        oneTime?: number;
      }
    | undefined;
  const [monthly, setMonthly] = useState<number | null>(
      Math.min(
        props.savedMonthly ?? initialMonthly ?? 0,
        Math.max(0, initialMonthly ?? 0),
      ),
    ),
    [buffer, setBuffer] = useState<number | null>(prior?.cashBuffer ?? 0),
    [lump, setLump] = useState<number | null>(props.lump);
  const [minimums, setMinimums] = useState<SipMinimums>(() =>
    Object.fromEntries(
      heldSipHoldings(investments).map((h) => [
        h.kind,
        props.initialMinimums?.[h.kind] ?? 0,
      ]),
    ),
  );
  const [overrides, setOverrides] = useState<Record<string, number>>(
      Object.fromEntries(
        Object.entries(prior?.overrides ?? {}).filter(([id]) =>
          goals.some((g) => g.id === id && !g.completed),
        ),
      ),
    ),
    [editing, setEditing] = useState(mode === "create" || !confirmed),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [pending, start] = useTransition();
  const router = useRouter();
  const links = useMemo(
    () =>
      proposeGoalMapping(
        goals,
        investments,
        confirmed ? props.links : [],
        today,
        { refresh: !!confirmed, riskTolerance: props.riskTolerance },
      ),
    [goals, investments, confirmed, props.links, today, props.riskTolerance],
  );
  const cap = Math.max(0, (initialMonthly ?? 0) - (buffer ?? 0));
  const minimumsFit =
    Object.values(minimums).reduce((s, n) => s + n, 0) <= (monthly ?? 0);
  const oneTimeAvailable = unallocatedLiquidValue(investments, links, today);
  const valid =
    monthly !== null &&
    Number.isSafeInteger(monthly) &&
    monthly >= 0 &&
    monthly <= cap &&
    buffer !== null &&
    buffer >= 0 &&
    lump !== null &&
    Number.isSafeInteger(lump) &&
    lump >= 0 &&
    lump <= oneTimeAvailable;
  let result: HybridResult | null = null,
    calculationError = "";
  const liveOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([id]) =>
      goals.some((g) => g.id === id && !g.completed),
    ),
  );
  const input = {
    riskTolerance: props.riskTolerance,
    today,
    goals,
    investments,
    links,
    monthlySavings: cap,
    monthlyPlanLimit: valid ? monthly! : 0,
    budgetDeficit:
      (props.budgetDeficit ?? 0) +
      Math.max(0, (buffer ?? 0) - (initialMonthly ?? 0)),
    oneTime: lump ?? 0,
    minimums,
    overrides: liveOverrides,
  };
  try {
    if (valid) result = hybridPlan(input);
  } catch (e) {
    calculationError = e instanceof Error ? e.message : "Check your amounts.";
  }
  const recorded = investments.reduce((s, i) => s + i.monthlySip, 0),
    saved = confirmed?.result;
  let fallback: HybridResult | null = null;
  if (!result && valid)
    try {
      fallback = hybridPlan({ ...input, overrides: {}, minimums: {} });
    } catch {}
  const display = !editing && saved ? saved : (result ?? fallback);
  return (
    <section className="space-y-4" aria-label="Hybrid savings plan">
      {confirmed && (
        <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
          <p className="font-medium">
            Confirmed {formatDate(todayIST(new Date(confirmed.createdAt)))}
          </p>
          <p className="text-muted-foreground">
            {confirmed.stale
              ? "Your inputs changed. Review a fresh recommendation before replacing this plan."
              : "Your confirmed plan is kept until you save a replacement."}
          </p>
        </div>
      )}
      {!editing && (
        <Button variant="outline" onClick={() => setEditing(true)}>
          Review updated plan
        </Button>
      )}
      {cap === 0 && editing && (
        <div className="surface-card space-y-2 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Nothing to invest each month right now</h2>
          <p className="text-sm text-muted-foreground">
            {(props.budgetDeficit ?? 0) > 0
              ? `Your budget shows ${formatINR(props.budgetDeficit!)} a month more going out than coming in, so there's no monthly amount to split across goals.`
              : "Your budget has nothing left for saving and investing each month, so there's no monthly amount to split across goals."}
          </p>
          <p className="text-sm text-muted-foreground">
            Your goals are still covered by the money you already have. When
            your salary starts, update your income in Budget and come back
            here.
          </p>
          <Link href="/goals/budget" className="inline-flex min-h-10 items-center text-sm font-medium text-primary">
            Open Budget
          </Link>
        </div>
      )}
      <div className="surface-card space-y-4 rounded-2xl border bg-card p-4">
        {!(cap === 0 && editing) && <>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-muted-foreground">
              Available each month
            </dt>
            <dd className="tabular text-2xl font-semibold">{cap>=1e6?formatINRCompact(cap):formatINR(cap)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Goals need each month
            </dt>
            <dd className="tabular text-2xl font-semibold">
              {(display?.totalMonthlyRequired??0)>=1e6?formatINRCompact(display!.totalMonthlyRequired):formatINR(display?.totalMonthlyRequired??0)}
            </dd>
          </div>
        </dl>
        {(props.budgetDeficit ?? 0) > 0 && (
          <p role="alert" className="text-sm text-danger">
            Budget deficit: {formatINR(props.budgetDeficit!)}. No new monthly
            contributions are recommended.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Recorded SIPs: {formatINR(recorded)}/month. A recorded SIP is a setup
          amount, not proof of a payment.
        </p>
        </>}
        {recorded > cap && (
          <p role="alert" className="text-sm text-warning">
            Recorded SIPs exceed the available amount by{" "}
            {formatINR(recorded - cap)}. Review them with your provider.
          </p>
        )}
        {editing && (
          <>
            {cap > 0 && (
              <Field label="Monthly plan amount" htmlFor="hybrid-monthly">
                <MoneyInput
                  id="hybrid-monthly"
                  value={monthly}
                  onChange={setMonthly}
                />
              </Field>
            )}
            <details>
              <summary className="min-h-10 cursor-pointer text-sm font-medium">
                Buffer and one-time money
              </summary>
              <div className="space-y-3 pt-2">
                <Field
                  label="Extra monthly cash buffer"
                  htmlFor="hybrid-buffer"
                  hint="Only money not already included in your expenses or personal bucket."
                >
                  <MoneyInput
                    id="hybrid-buffer"
                    value={buffer}
                    onChange={setBuffer}
                  />
                </Field>
                <Field
                  label="One-time amount from unallocated savings"
                  htmlFor="hybrid-lump"
                  hint="This is a plan, not a balance increase. It must come from unallocated recorded holdings."
                >
                  <MoneyInput
                    id="hybrid-lump"
                    value={lump}
                    onChange={setLump}
                  />
                </Field>
              </div>
            </details>
          </>
        )}
        {editing && !valid && (
          <p role="alert" className="text-sm text-danger">
            {cap > 0 && (monthly ?? 0) > cap
              ? `Your monthly plan can be at most ${formatINR(cap)}, what your budget has for saving and investing.`
              : `The one-time amount can be at most ${formatINR(oneTimeAvailable)}, the savings no goal is using.`}
          </p>
        )}
        {!minimumsFit && editing && (
          <p role="alert" className="text-sm text-danger">
            Your holding minimums exceed this plan. Lower them or increase the
            monthly amount within your budget.
          </p>
        )}
        {calculationError && editing && (
          <p role="alert" className="text-sm text-danger">
            {calculationError}
          </p>
        )}
        {display && display.immediateFundingShortfall > 0 && (
          <p role="alert" className="text-sm text-warning">
            {formatINR(display.immediateFundingShortfall)} needs immediate
            funding or a goal change. A new monthly SIP cannot cover this in
            time.
          </p>
        )}
        {display&&Object.values(minimums).some(v=>v>0)&&display.goals.some(g=>g.category==="essential"&&g.minimumShortfall>0)&&<p className="text-sm text-warning">Your chosen holding amounts leave an essential minimum short. Review those choices before confirming this tradeoff.</p>}
          {display && (
          <p className="rounded-xl bg-muted/50 p-3 text-sm">
            {formatINR(display.totalMonthlyAllocated)} planned each month
            {display.reservedOutsideGoals > 0
              ? ` · ${formatINR(display.reservedOutsideGoals)} not mapped to goals`
              : ""}
            {display.unallocatedSavings > 0
              ? ` · ${formatINR(display.unallocatedSavings)} left to assign`
              : ""}
            .
            {display.monthlyContributionShortfall > 0
              ? ` Goals still need ${formatINR(display.monthlyContributionShortfall)} more each month.`
              : " Monthly requirements are covered. Check any immediate funding needs below."}
          </p>
        )}
      </div>
      {editing && result && minimumsFit && (
        <div className="surface-card space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Where to contribute</h2>
          <InvestmentVehicles rows={hybridVehicles(input, result)} />
          <p className="text-xs text-muted-foreground">
            Recommended total monthly amounts, including existing SIPs. No money
            moves and no SIP is started or reduced automatically.
          </p>
        </div>
      )}
      {!editing && saved && (
        <div className="surface-card space-y-2 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Your confirmed plan</h2>
          <p className="text-sm">
            {formatINR(saved.totalMonthlyAllocated)} per month for goals. Open
            Review updated plan to see current vehicle recommendations.
          </p>
          {confirmed && !!(confirmed.inputs as HybridPlanInput)?.goals && (
            <InvestmentVehicles
              rows={
                saved.vehicles ??
                hybridVehicles(confirmed.inputs as HybridPlanInput, saved)
              }
            />
          )}
        </div>
      )}
      {editing && heldSipHoldings(investments).length > 0 && (
        <details className="surface-card rounded-2xl border bg-card px-4">
          <summary className="min-h-12 cursor-pointer text-sm font-semibold">
            Monthly amounts for your holdings
          </summary>
          <p className="pb-3 text-xs text-muted-foreground">
            Optional destination minimums within this budget. Zero lets the
            planner choose. These are total amounts, not additions to a running
            SIP.
          </p>
          <div className="space-y-3 pb-4">
            {heldSipHoldings(investments).map((h) => (
              <Field
                key={h.kind}
                label={h.label}
                htmlFor={`minimum-${h.kind}`}
                className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 space-y-0"
              >
                <MoneyInput
                  id={`minimum-${h.kind}`}
                  value={minimums[h.kind] ?? 0}
                  onChange={(v) =>
                    setMinimums((m) => ({ ...m, [h.kind]: v ?? 0 }))
                  }
                />
              </Field>
            ))}
          </div>
        </details>
      )}
      {display && (
        <details className="surface-card rounded-2xl border bg-card px-4">
          <summary className="min-h-12 cursor-pointer font-semibold">
            Why this plan?
          </summary>
          <p className="pb-3 text-xs text-muted-foreground">
            Essentials first, then flexible goals by priority, deadline and
            need. Changing an amount below is a manual override. It can leave
            essentials short.
          </p>
          <ul className="divide-y">
            {display.goals.map((g) => (
              <li key={g.goalId} className="space-y-2 py-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <b className="min-w-0 break-words text-sm">{g.goalName}</b>
                  <span className="text-xs text-muted-foreground">
                    {g.needsDate ? "Needs a date" : LABEL[g.status]}
                  </span>
                </div>
                <Progress
                  value={
                    g.targetCorpus
                      ? Math.min(
                          100,
                          (g.existingCoverage / g.targetCorpus) * 100,
                        )
                      : 100
                  }
                  label={`${g.goalName} funding progress`}
                />
                <p className="text-xs text-muted-foreground">
                  {formatINR(g.existingCoverage)} allocated today · Target{" "}
                  {formatINR(g.targetCorpus)}
                </p>
                <p className="text-sm">
                  Needs {formatINR(g.requiredMonthly)}/mo · Planned{" "}
                  {formatINR(g.recommendedMonthly)}/mo
                </p>
                {editing && (
                  <Field
                    label={`Monthly amount for ${g.goalName}`}
                    htmlFor={`goal-${g.goalId}`}
                  >
                    <MoneyInput
                      id={`goal-${g.goalId}`}
                      value={overrides[g.goalId] ?? g.recommendedMonthly}
                      onChange={(v) =>
                        setOverrides((o) => ({ ...o, [g.goalId]: v ?? 0 }))
                      }
                    />
                  </Field>
                )}
                {editing && Object.hasOwn(overrides, g.goalId) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setOverrides((o) =>
                        Object.fromEntries(
                          Object.entries(o).filter(([id]) => id !== g.goalId),
                        ),
                      )
                    }
                  >
                    Use recommendation
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">{g.explanation}</p>
                <details>
                  <summary className="min-h-10 cursor-pointer text-xs font-medium">
                    Projection and assumptions
                  </summary>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      Projected existing corpus:{" "}
                      {formatINR(g.projectedExistingCorpus)}. With this plan:{" "}
                      {formatINR(g.projectedCorpus)}. Shortfall:{" "}
                      {formatINR(g.projectedShortfall)}. Surplus:{" "}
                      {formatINR(g.projectedSurplus)}.
                    </p>
                    {g.assumptions.existingInvestmentReturns?.map((h) => (
                      <p key={h.investmentId}>
                        {investments.find((i) => i.id === h.investmentId)
                          ?.name || "Holding"}
                        : {h.annualReturnPct}% yearly for the existing corpus (
                        {h.source === "user"
                          ? "your assumption"
                          : "conservative default"}
                        ).
                      </p>
                    ))}
                    <p>
                      Monthly gap: {formatINR(g.monthlyShortfall)}. Unmet
                      minimum: {formatINR(g.minimumShortfall)}. Immediate
                      funding gap: {formatINR(g.immediateShortfall)}. Requested
                      monthly minimum: {formatINR(g.minimumMonthly)}.
                      Contribution return: {g.assumptions.annualReturnPct}%
                      yearly. Inflation: {g.assumptions.inflationPct}%.
                      Contributions at month end.
                    </p>
                    {g.assumptions.emergencyBuildMonths && (
                      <p>
                        Undated emergency fund: a visible{" "}
                        {g.assumptions.emergencyBuildMonths}-month build
                        assumption.
                      </p>
                    )}
                    <p>
                      Achievable future amount:{" "}
                      {formatINR(g.alternatives.achievableTarget)}
                      {g.alternatives.revisedDeadline
                        ? ` · Alternative date ${formatDate(g.alternatives.revisedDeadline)}`
                        : ""}
                      . Your goal is unchanged.
                    </p>
                    {g.warnings.map((w, i) => (
                      <p key={i}>
                        {investments.reduce(
                          (text, inv) =>
                            text.replaceAll(inv.id, inv.name || "Holding"),
                          w,
                        )}
                      </p>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </details>
      )}
      {display && (
        <details className="rounded-xl bg-muted/40 px-4">
          <summary className="min-h-11 cursor-pointer text-sm">
            Coverage mapping and policy
          </summary>
          <p className="text-xs text-muted-foreground">
            {editing
              ? "Proposed ownership, confirmed only when you save. Confirmed ownership stays unchanged until you approve this proposal. Surplus coverage can be released in a new confirmed plan."
              : "Ownership captured with this confirmed plan."}
          </p>
          <ul className="space-y-2 py-3 text-xs">
            {display.links.map((l) => (
              <li key={`${l.goalId}:${l.investmentId}`}>
                {investments.find((i) => i.id === l.investmentId)?.name ||
                  "Holding"}{" "}
                → {goals.find((g) => g.id === l.goalId)?.name || "Removed goal"}
                : {l.percent}%
              </li>
            ))}
          </ul>
          <p className="pb-3 text-xs text-muted-foreground">
            {display.warnings.map((warning, index) => (
              <span key={index} className="mb-1 block">
                {warning}
              </span>
            ))}
            Unassigned recorded investments:{" "}
            {formatINR(
              display.unallocatedInvestments.reduce((s, i) => s + i.value, 0),
            )}
            . Priority weights: High {display.policy.priority.high}, Medium {display.policy.priority.medium}, Low {display.policy.priority.low}. Urgency weights: {display.policy.urgency[0]} within 12 months, {display.policy.urgency[1]} within 36 months, {display.policy.urgency[2]} later. Flexible weights multiply these by remaining monthly need. Valuation review after {display.policy.staleDays} days. Unused monthly capacity is considered first. At risk then allows an extra gap within{" "}
            {display.policy.atRiskMonthlyIncreasePct}% of this plan’s capacity;
            larger gaps are underfunded. {display.engineVersion} ·{" "}
            {display.calculatedOn}. Risk preference:{" "}
            {display.riskTolerance ?? "not provided, balanced defaults"}.
            Returns are assumptions, not guarantees.
          </p>
        </details>
      )}
      {editing && (
        <>
          <p className="text-xs text-muted-foreground">
            Confirming saves this plan and coverage mapping. Holdings, balances,
            provider SIPs and your budget are unchanged.
          </p>
          {(error || success) && (
            <p role={error ? "alert" : "status"} className="text-sm">
              {error || "Plan confirmed."}
            </p>
          )}
          {error && (
            <Button variant="outline" onClick={() => router.refresh()}>
              Refresh recommendation
            </Button>
          )}
          <Button
            className="w-full"
            disabled={pending || !valid || !result || !revision || !minimumsFit}
            onClick={() =>
              start(async () => {
                setError("");
                try {
                  const r = await confirmHybridPlan({
                    calculatedOn:today,
                    revision: revision!,
                    monthly: monthly!,
                    lump: lump!,
                    cashBuffer: buffer ?? 0,
                    refreshMapping: !!confirmed,
                    minimums,
                    overrides: liveOverrides,
                  });
                  if (!r.ok) {
                    setError(r.error);
                    return;
                  }
                  setSuccess(true);
                  router.replace("/goals/plan");
                  router.refresh();
                  setEditing(false);
                } catch {
                  setError(
                    "Connection interrupted. Refresh to check whether the plan was confirmed before retrying.",
                  );
                }
              })
            }
          >
            {pending ? "Saving…" : "Confirm plan"}
          </Button>
        </>
      )}
      {history.length > 0 && (
        <details className="surface-card rounded-2xl border bg-card px-4">
          <summary className="min-h-12 cursor-pointer text-sm font-semibold">
            Previous plans
          </summary>
          <ul className="divide-y">
            {history.map((p) => (
              <li key={p.id} className="py-3">
                <details>
                  <summary className="min-h-10 cursor-pointer text-sm">
                    {formatDate(todayIST(new Date(p.createdAt)))} ·{" "}
                    {formatINR(p.result.totalMonthlyAllocated)}/mo
                  </summary>
                  <p className="text-xs text-muted-foreground">
                    {p.result.engineVersion}. Original snapshot; current
                    balances do not rewrite it.
                  </p>
                  {p.result.goals.map((g) => (
                    <p key={g.goalId} className="text-xs">
                      {g.goalName}: {formatINR(g.recommendedMonthly)}/mo ·{" "}
                      {LABEL[g.status]}
                    </p>
                  ))}
                </details>
              </li>
            ))}
          </ul>
        </details>
      )}
      <Link
        href="/assets/withdraw"
        className="inline-flex min-h-11 items-center text-sm text-primary"
      >
        Plan a withdrawal
      </Link>
      <Link
        href="/assets?do=update"
        className="inline-flex min-h-11 items-center text-sm text-primary"
      >
        Record actual balances or SIPs
      </Link>
    </section>
  );
}
