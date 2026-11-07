import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { GuideButton } from "@/components/guides";
import { NetWorthCard } from "@/components/net-worth-card";
import { NextStep } from "@/components/next-step";
import { Progress } from "@/components/ui/progress";
import { loadCards, loadLoans, loadMoneyPlan, loadNetWorth } from "@/lib/data";
import { creditPayments } from "@/lib/credit-payments";
import { homeCardSummary, homeGoals } from "@/lib/home-summary";
import { dueLabel } from "@/lib/cards";
import { formatDate, formatINR, formatINRCompact } from "@/lib/format";
import { monthYear } from "@/lib/goal-summary";
import { goalStatus } from "@/lib/goal-status";
import { planSteps } from "@/lib/sip-plan";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };
const surface = "surface-card rounded-2xl border border-border/70 bg-card p-4";
const tile =
  "press min-w-0 space-y-1 rounded-xl bg-muted/45 p-3 hover:bg-muted";

export default async function OverviewPage() {
  // The existing request-cached snapshot supplies all the section loaders.
  const [money, { cards }, loans, worth] = await Promise.all([
    loadMoneyPlan(),
    loadCards(),
    loadLoans(),
    loadNetWorth(),
  ]);
  const { budget, goals, plan, investments, links, sipsNow, today } = money;
  const statements = homeCardSummary(cards, today);
  const payments = creditPayments(cards, loans, today).filter(
    (p) => p.kind !== "linked",
  );
  const preview = homeGoals(goals);
  const steps = plan
    ? planSteps(plan.suggestions, investments, links, "diversified").length
    : 0;
  const needed = goals
    .filter((g) => g.status !== "reached" && !g.emisCloseFirst)
    .reduce((sum, g) => sum + g.extraSipNeeded, 0);
  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
          <GuideButton id="home" />
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDate(today)}
        </span>
      </div>

      <NetWorthCard history={worth.history} compact />
      <NextStep
        plan={plan ? { monthlyTotal: plan.monthlyTotal } : null}
        budget={{ income: budget.income, planMonthly: budget.planMonthly }}
        steps={steps}
        needed={needed}
      />

      <section className={surface} aria-labelledby="home-month-h">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="home-month-h" className="font-semibold">
            This month
          </h2>
          <span className="text-xs text-muted-foreground">
            {monthYear(today)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* No income yet: the Next step card asks for the budget instead. */}
          {budget.income > 0 && (
            <Link href="/goals/budget" className={tile}>
              <p className="text-xs text-muted-foreground">
                {budget.free < 0
                  ? "Budget shortfall"
                  : "Free to invest / month"}
              </p>
              <p
                className={cn(
                  "tabular break-words text-lg font-semibold tracking-tight",
                  budget.free < 0 && "text-danger",
                )}
              >
                {formatINR(Math.abs(budget.free))}
              </p>
              <p className="text-[11px] text-muted-foreground">
                After costs, EMIs and current SIPs
              </p>
            </Link>
          )}
          <Link href={plan ? "/goals/plan" : "/goals?do=plan"} className={tile}>
            <p className="text-xs text-muted-foreground">Monthly SIPs</p>
            <p className="tabular break-words text-lg font-semibold tracking-tight">
              {formatINR(sipsNow)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Recorded in your holdings
            </p>
          </Link>
          <Link
            href="/cards"
            className={cn(tile, budget.income > 0 && "col-span-2")}
          >
            <p className="text-xs text-muted-foreground">
              {statements.unpaid > 0 ? "Card bills to pay" : "Card statements"}
            </p>
            <p
              className={cn(
                "tabular break-words text-lg font-semibold tracking-tight",
                !statements.month && "text-base",
              )}
            >
              {statements.unpaid > 0
                ? formatINR(statements.unpaid)
                : statements.month
                  ? formatINR(statements.total)
                  : cards.length
                    ? "Not logged yet"
                    : "No cards added"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {statements.month
                ? `${monthYear(`${statements.month}-01`)} statements · ${statements.cardsUpdated} of ${statements.cards} cards${statements.unpaid > 0 ? "" : " · all paid"}`
                : "Log statements in Credit"}
            </p>
          </Link>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Card figures are logged statements, including any EMIs on them. Not
          live spending.
        </p>
      </section>

      <section className={surface} aria-labelledby="home-payments-h">
        <div className="flex items-center justify-between gap-3">
          <h2 id="home-payments-h" className="font-semibold">
            Payments coming up
          </h2>
          <Link
            href="/cards"
            className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary"
          >
            View all
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        {payments.length ? (
          <ul className="divide-y" aria-label="Upcoming payments">
            {payments.slice(0, 3).map((p) => {
              const due = dueLabel(p.date, today);
              return (
                <li key={p.key}>
                  <Link
                    href={
                      p.cardId
                        ? `/cards?open=${encodeURIComponent(p.cardId)}`
                        : "/cards#loans-h"
                    }
                    className="press flex min-h-16 items-center justify-between gap-3 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium">
                        {p.name}
                      </span>
                      <span
                        className={cn(
                          "block text-xs",
                          due.tone === "danger"
                            ? "text-danger"
                            : due.tone === "warning"
                              ? "text-warning"
                              : "text-muted-foreground",
                        )}
                      >
                        {due.text}
                      </span>
                      {p.statementMonth && (
                        <span className="block text-[11px] text-muted-foreground">
                          {monthYear(p.statementMonth)} statement
                        </span>
                      )}
                    </span>
                    <span className="tabular shrink-0 text-sm font-semibold">
                      {formatINR(p.amount)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No overdue or current-month payments recorded.
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Overdue and due this month. Record payments in Credit.
        </p>
      </section>

      <section className={surface} aria-labelledby="home-goals-h">
        <div className="flex items-center justify-between gap-3">
          <h2 id="home-goals-h" className="font-semibold">
            Goal progress
          </h2>
          <Link
            href="/goals"
            className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary"
          >
            View all
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        {preview.length ? (
          <ul className="divide-y">
            {preview.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/goals?open=${encodeURIComponent(g.id)}#your-goals`}
                  className="press block space-y-2 py-3"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words text-sm font-medium">
                      {g.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {goalStatus(g, today).label === "Behind"
                        ? "Behind today"
                        : goalStatus(g, today).label}
                    </span>
                  </span>
                  <Progress
                    value={g.progress * 100}
                    className="h-1.5"
                    tone="neutral"
                    label={`${g.name} progress`}
                  />
                  <span className="tabular block text-xs text-muted-foreground">
                    {formatINRCompact(g.current)} of{" "}
                    {formatINRCompact(g.futureTarget)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {goals.length
                ? "Your goals are reached or covered at your current pace. Open Goals for the details."
                : "Add a goal to see what you are working toward."}
            </p>
            <Link
              href={goals.length ? "/goals" : "/goals/new"}
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
            >
              {goals.length ? "Open goals" : "Add your first goal"}
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
