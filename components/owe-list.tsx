import { ChevronRight, Landmark } from "lucide-react";
import { LoanManagement } from "@/components/loan-management";
import { Progress } from "@/components/ui/progress";
import { formatINR, formatINRCompact } from "@/lib/format";
import { monthYear } from "@/lib/goal-summary";
import { loanView, type Loan } from "@/lib/loans";

/** What you owe: each loan's balance and how much is repaid. Tap one to manage the loan. */
export function OweList({ loans, today }: { loans: Loan[]; today: string }) {
  const all = loans.map(l=>loanView(l,today));
  const views = all
    .filter((v) => !v.closed)
    .sort((a, b) => b.state.balance - a.state.balance);
  const total = views.reduce((s, v) => s + v.state.balance, 0);
  return (
    <section
      aria-labelledby="owe-h"
      data-guide="owe"
      className="surface-card space-y-3 rounded-2xl border border-border/70 bg-card p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="owe-h" className="font-semibold">
          What you owe
        </h2>
        <span className="tabular font-semibold">{formatINR(total)}</span>
      </div>
      {views.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active loans.
        </p>
      ) : (
        <ul className="divide-y">
          {views.map((v) => {
            const content=(<>
                  <span
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
                    aria-hidden
                  >
                    <Landmark className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="break-words text-sm font-medium">
                        {v.loan.name}
                      </span>
                      <span className="tabular text-sm">
                        {formatINR(v.state.balance)}
                      </span>
                    </span>
                    {v.repaid !== null && v.loan.principal ? (
                      <Progress
                        className="h-1.5"
                        value={v.progress * 100}
                        tone="neutral"
                        label={`${v.loan.name} repaid`}
                      />
                    ) : null}
                    <span className="tabular block text-xs text-muted-foreground">
                      {v.repaid !== null && v.loan.principal
                        ? `${formatINRCompact(v.repaid)} repaid of ${formatINRCompact(v.loan.principal)}`
                        : `${formatINR(v.state.emi)} a month`}
                      {v.state.endDate
                        ? ` · ends ${monthYear(v.state.endDate)}`
                        : ""}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
            </>);
            return (
              <li key={v.loan.id} className="py-2">
                <LoanManagement loan={v.loan}>{content}</LoanManagement>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Tap a loan to update its balance, mark it closed or remove it.
      </p>
    </section>
  );
}
