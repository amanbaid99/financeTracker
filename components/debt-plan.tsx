import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DebtPayoffPlan } from "@/lib/engine/debt";
import { formatDate, formatINR, formatMonths } from "@/lib/format";
import { LIABILITY_LABELS } from "@/lib/labels";

export function DebtPlanCard({ plan, afterGoals }: { plan: DebtPayoffPlan; afterGoals: boolean }) {
  if (plan.rows.length === 0) return null;
  const costly = plan.rows.filter((r) => r.costly);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Debt payoff plan</CardTitle>
        <CardDescription>
          {plan.method === "snowball"
            ? "Snowball method: smallest balance first. Each debt you clear frees its payment for the next."
            : "Avalanche method: highest interest rate first."}{" "}
          {afterGoals
            ? "Your goals get their monthly amounts first; only what's left goes to extra debt payments."
            : "Extra payments go to debt before goals."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Extra each month</dt>
            <dd className="tabular font-semibold">{formatINR(plan.extraMonthly)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Costly debt cleared in</dt>
            <dd className="tabular font-semibold">
              {costly.length === 0
                ? "No costly debt"
                : plan.costlyFreeInMonths === null
                  ? "Not at this pace"
                  : formatMonths(plan.costlyFreeInMonths)}
            </dd>
          </div>
        </dl>
        {plan.extraMonthly === 0 && costly.length > 0 && (
          <p className="text-xs text-muted-foreground">
            No extra money is free for debt right now, so these are cleared by their EMIs alone. Extra payments start
            once your safety net and goals are covered.
          </p>
        )}
        <ol className="divide-y rounded-lg border">
          {plan.rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 p-3 text-sm">
              <span className="tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {r.order}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{r.label || LIABILITY_LABELS[r.kind]}</p>
                  {!r.costly && <Badge variant="muted">Low rate · EMI only</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatINR(r.balance)} at {r.ratePct}%{r.rateAssumed ? " (assumed)" : ""}
                  {r.emi ? ` · EMI ${formatINR(r.emi)}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-right text-xs">
                {r.clearedInMonths === null ? (
                  <span className="text-danger">Not cleared at this pace</span>
                ) : (
                  <>
                    <span className="block font-medium">{formatDate(r.clearDate).slice(-8)}</span>
                    <span className="text-muted-foreground">{formatMonths(r.clearedInMonths)}</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          Total interest until cleared: {formatINR(plan.totalInterest)}. Switch between snowball and avalanche in{" "}
          <Link href="/settings" className="text-primary underline">
            Settings
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
