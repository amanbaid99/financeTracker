import { ArrowRight, CircleCheck } from "lucide-react";
import Link from "next/link";
import { AiExplain } from "@/components/ai-explain";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import type { NextFocus } from "@/lib/engine";
import { formatINR, formatINRCompact, formatMonths } from "@/lib/format";
import { LIABILITY_LABELS } from "@/lib/labels";

function Stat({ label, value, tip }: { label: string; value: string; tip?: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {tip && <InfoTip text={tip} />}
      </dt>
      <dd className="tabular truncate text-lg font-semibold sm:text-xl">{value}</dd>
    </div>
  );
}

export function NextFocusCard({ focus, aiOn }: { focus: NextFocus | null; aiOn: boolean }) {
  if (!focus) {
    return (
      <Card className="border-success/40">
        <CardContent className="flex items-start gap-3 pt-5 sm:pt-5">
          <CircleCheck className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
          <div className="space-y-1">
            <p className="text-lg font-semibold">You&apos;re on track</p>
            <p className="text-sm text-muted-foreground">
              Every step is done and every goal is on track. Keep your SIPs running and check in monthly.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  const isAsk = focus.step.status === "unknown";
  const isCover = focus.step.kind === "cover";
  return (
    <Card className="overflow-hidden border-primary/40">
      <div className="h-1 bg-primary" aria-hidden />
      <CardContent className="space-y-4 pt-4 sm:pt-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Next focus</p>
            <Badge variant="muted">
              Step {focus.step.id} of 6 · {focus.step.name}
            </Badge>
          </div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{focus.title}</h1>
        </div>

        {!isAsk && (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label={isCover ? "Cover missing" : focus.step.kind === "cashflow" ? "Monthly shortfall" : "Gap"}
              value={formatINRCompact(focus.gap)}
            />
            {focus.monthly !== null && (
              <Stat
                label="Put toward it monthly"
                value={formatINR(focus.monthly)}
                tip="New savings from your budget plus your share of any variable income. Existing SIPs keep running."
              />
            )}
            {focus.monthsToComplete !== null && (
              <Stat label="Done in about" value={formatMonths(focus.monthsToComplete)} />
            )}
          </dl>
        )}

        <p className="text-sm leading-relaxed text-muted-foreground">{focus.reason}</p>

        {focus.step.debts && focus.step.debts.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Pay in this order</p>
            <ol className="space-y-1 text-sm">
              {focus.step.debts.map((d, i) => (
                <li key={d.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {i + 1}. {d.label || LIABILITY_LABELS[d.kind]}
                    {d.interestRate !== null ? ` (${d.interestRate}%)` : ""}
                  </span>
                  <span className="tabular">{formatINR(d.outstanding)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {focus.goalSplit && focus.goalSplit.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">This month&apos;s split</p>
            <ul className="space-y-1 text-sm">
              {focus.goalSplit.map((g) => (
                <li key={g.goalId} className="flex justify-between gap-2">
                  <Link href={`/goals/${g.goalId}`} className="truncate underline-offset-2 hover:underline">
                    {g.name}
                  </Link>
                  <span className="tabular">{formatINR(g.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Link href={focus.href} className={buttonVariants()}>
            {focus.action} <ArrowRight />
          </Link>
          {aiOn && !isAsk && <AiExplain feature="next_focus" label="Explain why" />}
        </div>
      </CardContent>
    </Card>
  );
}
