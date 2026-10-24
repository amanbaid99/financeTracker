import type { Metadata } from "next";
import Link from "next/link";
import { BudgetChart } from "@/components/budget-chart";
import { BudgetRatios, type RatioValues } from "@/components/forms/settings-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { loadAnalysis } from "@/lib/data";
import { defaultConfig, type EngineConfig } from "@/lib/engine/config";
import type { StreamRole } from "@/lib/engine/budget";
import { formatDate, formatINR } from "@/lib/format";
import { INCOME_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Budget" };

const ROLE_RULE: Record<StreamRole, string> = {
  base: "All base",
  variable_salary: "Base + 50/30/20 split",
  secondary_job: "70% plan, 30% wants",
  freelance: "Tax first, then pay-yourself salary",
  bonus: "One-off: 50/30/20 split",
};

function Row({ label, value, strong, tip }: { label: string; value: number; strong?: boolean; tip?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 text-sm ${strong ? "font-semibold" : ""}`}>
      <span className="flex items-center gap-1">
        {label}
        {tip && <InfoTip text={tip} />}
      </span>
      <span className="tabular">{formatINR(value)}</span>
    </div>
  );
}

const p = (x: number) => Math.round(x * 1000) / 10;

function ratioValues(c: EngineConfig): RatioValues {
  const b = c.budget;
  return {
    savingsMinPct: p(b.savingsMinPct),
    capPct: p(b.essentialsPlusSavingsCapPct),
    variable: [p(b.variableSurplus.ladder), p(b.variableSurplus.goals), p(b.variableSurplus.wants)],
    bonus: [p(b.bonusSurplus.ladder), p(b.bonusSurplus.goals), p(b.bonusSurplus.wants)],
    secondary: [p(b.secondarySurplus.ladderGoals), p(b.secondarySurplus.wants)],
    retirementBaselinePct: p(c.ladder.retirementBaselinePct),
    taxReservePct: p(b.freelance.taxReservePct),
  };
}

export default async function BudgetPage() {
  const { analysis } = await loadAnalysis();
  const { budget, config } = analysis;
  const pctOf = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <main className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
        <p className="text-sm text-muted-foreground">{budget.reason}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Base income each month: {formatINR(budget.baseIncome)}</CardTitle>
          <CardDescription>
            The money you can count on. Essentials come first, then savings (at least{" "}
            {pctOf(config.budget.savingsMinPct)}), and the rest is yours to spend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BudgetChart split={budget.split} base={budget.baseIncome} />
          <div className="divide-y">
            <Row
              label="Essentials"
              value={budget.split.essentials}
              tip={`Expenses ${formatINR(budget.essentials.expenses)}${budget.essentials.estimated ? " (estimated)" : ""}, EMIs ${formatINR(budget.essentials.emis)}, insurance premiums ${formatINR(budget.essentials.insurancePremiums)}, planned expenses ${formatINR(budget.essentials.planned)} a month.`}
            />
            <Row label="Savings" value={budget.split.savings} />
            <Row label="Wants" value={budget.split.wants} />
            {budget.split.shortfall > 0 && <Row label="Shortfall" value={-budget.split.shortfall} strong />}
          </div>
          <p className="text-xs text-muted-foreground">{budget.split.reason}</p>
          <p className="text-xs text-muted-foreground">
            Have costs that come round every few months, like the gym or servicing?{" "}
            <Link href="/details/planned?from=budget" className="text-primary underline">
              Plan for them
            </Link>{" "}
            and a monthly share is set aside.
          </p>
          {budget.notes.map((n) => (
            <p key={n} className="rounded-lg bg-warning-soft p-2 text-xs text-warning">
              {n}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Income streams</CardTitle>
            <Link href="/details/income" className="text-sm text-primary underline-offset-2 hover:underline">
              Edit
            </Link>
          </div>
          <CardDescription>Each type of income follows its own rule.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {budget.streams.map((s) => (
              <li key={s.id} className="space-y-1 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{s.label}</span>
                  <Badge variant="muted">{INCOME_TYPE_LABELS[s.type]}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">{s.oneOff ? "Amount" : "Usual month"}</dt>
                    <dd className="tabular">{formatINR(s.oneOff ? s.surplus : s.expectedMonthly)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Base</dt>
                    <dd className="tabular">{formatINR(s.base)}</dd>
                  </div>
                  {s.taxReserve > 0 && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Tax reserve</dt>
                      <dd className="tabular">{formatINR(s.taxReserve)}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-muted-foreground">Rule</dt>
                    <dd>{ROLE_RULE[s.role]}</dd>
                  </div>
                </dl>
                {s.surplus > 0 && (
                  <p className="tabular text-xs text-muted-foreground">
                    Surplus {formatINR(s.surplus)}: {formatINR(s.split.ladder)} to your next step,{" "}
                    {formatINR(s.split.goals)} to goals, {formatINR(s.split.wants)} for wants.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{s.reason}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {(budget.monthlySurplus.ladder + budget.monthlySurplus.goals + budget.monthlySurplus.wants > 0 ||
        budget.oneOff.total > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Above your base</CardTitle>
            <CardDescription>Extra income follows fixed rules so it doesn&apos;t quietly disappear.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <Row label="To your next step (monthly)" value={budget.monthlySurplus.ladder} />
            <Row label="To goals (monthly)" value={budget.monthlySurplus.goals} />
            <Row label="Wants (monthly)" value={budget.monthlySurplus.wants} />
            {budget.oneOff.total > 0 && (
              <>
                <Row label="One-offs: next step" value={budget.oneOff.ladder} />
                <Row label="One-offs: goals" value={budget.oneOff.goals} />
                <Row label="One-offs: wants" value={budget.oneOff.wants} />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {budget.freelancer && (
        <Card>
          <CardHeader>
            <CardTitle>Freelance and business</CardTitle>
            <CardDescription>
              Income lands in a buffer first. Tax is set aside, then you pay yourself a steady salary.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <Row label="Pay-yourself salary" value={budget.freelancer.payYourselfSalary} />
            <Row label="Tax reserve each month" value={budget.freelancer.taxReserveMonthly} />
            <Row
              label="Buffer target"
              value={budget.freelancer.bufferTarget}
              tip={`${config.budget.freelance.bufferTargetMonths} months of your pay-yourself salary, so lean months don't hurt.`}
            />
            {budget.freelancer.nextAdvanceTaxDate && (
              <p className="pt-2 text-sm">
                Next advance tax date:{" "}
                <span className="font-medium">{formatDate(budget.freelancer.nextAdvanceTaxDate)}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {budget.essentials.biggestLines.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Biggest essentials</CardTitle>
              <Link href="/details/expenses" className="text-sm text-primary underline-offset-2 hover:underline">
                Edit
              </Link>
            </div>
          </CardHeader>
          <CardContent className="divide-y">
            {budget.essentials.biggestLines.map((l) => (
              <Row key={l.label} label={l.label} value={l.amount} />
            ))}
          </CardContent>
        </Card>
      )}
      <Card id="ratios">
        <CardHeader>
          <CardTitle>Your ratios</CardTitle>
          <CardDescription>
            How base income splits between essentials, savings and wants, and where extra income goes. Your plan
            updates as soon as you save.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BudgetRatios values={ratioValues(config)} defaults={ratioValues(defaultConfig)} />
        </CardContent>
      </Card>
    </main>
  );
}
