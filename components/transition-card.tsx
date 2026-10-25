import { Hourglass } from "lucide-react";
import { TransitionPicker } from "@/components/transition-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TransitionPlan } from "@/lib/engine/transition";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

const monthsText = (m: number) =>
  m < 1 ? "less than a month" : `${Math.floor(m)} month${Math.floor(m) === 1 ? "" : "s"}`;

/** Between incomes: what you live on, in what order, and how long it lasts. */
export function TransitionCard({ plan, openPicker = false }: { plan: TransitionPlan; openPicker?: boolean }) {
  const tone =
    plan.months === null ? "" : plan.months < 3 ? "text-danger" : plan.months < 6 ? "text-warning" : "text-success";
  const span = Math.max(0.1, plan.funds.at(-1)?.toMonth ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hourglass className="size-4" aria-hidden /> Living on your savings
        </CardTitle>
        <CardDescription>
          While you&apos;re between jobs, these holdings pay for your essentials, in the order shown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan.months === null ? (
          <p className="text-sm">Add your monthly expenses to see how long your money lasts.</p>
        ) : (
          <div className="space-y-1">
            <p className={cn("text-2xl font-semibold", tone)}>{monthsText(plan.months)}</p>
            <p className="text-sm text-muted-foreground">
              {formatINR(Math.max(0, plan.total - plan.cardDues))} covers {formatINR(plan.monthlyNeed)} a month of
              essentials{plan.runsOutOn ? `, until about ${formatDate(plan.runsOutOn)}` : ""}.
            </p>
            {plan.sipsMonthly > 0 && plan.monthsWithSips !== null && (
              <p className="text-sm text-muted-foreground">
                With your SIPs still running: {monthsText(plan.monthsWithSips)}.
              </p>
            )}
            {plan.actBy && plan.months >= 3 && (
              <p className="text-sm">
                Aim to have new income lined up by <span className="font-medium">{formatDate(plan.actBy)}</span>, when 3
                months are left.
              </p>
            )}
          </div>
        )}

        {plan.funds.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Use in this order</h3>
            <ol className="space-y-2">
              {plan.funds.map((f, i) => (
                <li key={f.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {i + 1}. {f.label}
                      <span className="text-xs text-muted-foreground"> · {f.kindLabel}</span>
                    </span>
                    <span className="tabular shrink-0">{formatINR(f.value)}</span>
                  </div>
                  {plan.months !== null && (
                    <>
                      <div className="relative h-1.5 rounded-full bg-muted" aria-hidden>
                        <div
                          className="absolute inset-y-0 rounded-full bg-series-1"
                          style={{
                            left: `${(f.fromMonth / span) * 100}%`,
                            width: `${Math.max(1, ((f.toMonth - f.fromMonth) / span) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {f.toMonth <= 0
                          ? "Goes to card bills"
                          : `Months ${Math.floor(f.fromMonth) + 1} to ${Math.max(Math.floor(f.fromMonth) + 1, Math.ceil(f.toMonth))}`}
                        {f.goalLinked ? " · saved for a goal" : ""}
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {plan.thisMonth.length > 0 && (
          <p className="rounded-lg bg-muted p-3 text-sm">
            This month, take{" "}
            {plan.thisMonth.map((t, i) => (
              <span key={t.label}>
                {i > 0 && (i === plan.thisMonth.length - 1 ? " and " : ", ")}
                <span className="tabular font-medium">{formatINR(t.amount)}</span> from {t.label}
              </span>
            ))}
            .
          </p>
        )}

        {plan.notes.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {plan.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        <details className="group rounded-lg border" open={openPicker || !plan.chosen}>
          <summary className="cursor-pointer list-none p-3 text-sm font-medium">
            {plan.chosen ? "Change which holdings you live on" : "Pick the holdings you'll live on"}
          </summary>
          <div className="border-t p-3">
            <TransitionPicker items={plan.candidates} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
