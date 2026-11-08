"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import {
  CreditPaymentButton,
  CreditPaymentProvider,
} from "@/components/credit-payment";
import { dueLabel } from "@/lib/cards";
import type { CreditPayment } from "@/lib/credit-payments";
import { formatINR } from "@/lib/format";
import { monthYear } from "@/lib/goal-summary";
import type { cashCheck } from "@/lib/home-summary";
import { cn } from "@/lib/utils";

/**
 * This month's dues, whether quick-to-reach savings cover them, how long
 * the rest would last, and each payment with Mark paid.
 */
export function HomeDues({
  payments,
  check,
  today,
}: {
  payments: CreditPayment[];
  check: ReturnType<typeof cashCheck>;
  today: string;
}) {
  const { due, liquid, after, months, monthlyOut } = check;
  const covered = after >= 0;
  const share = due > 0 ? Math.min(1, liquid / due) : 1;
  return (
    <CreditPaymentProvider>
      <section
        className="surface-card space-y-3 rounded-2xl border border-border/70 bg-card p-4"
        aria-labelledby="home-dues-h"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="home-dues-h" className="font-semibold">
            Due this month
          </h2>
          <Link
            href="/cards"
            className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary"
          >
            Credit
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        {due > 0 ? (
          <div className="space-y-2">
            <p className="tabular text-2xl font-semibold tracking-tight">
              {formatINR(due)}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                by {monthYear(today).split(" ")[0]} end
              </span>
            </p>
            <div
              className="h-2 overflow-hidden rounded-full bg-danger-soft"
              role="img"
              aria-label={`Liquid savings cover ${Math.round(share * 100)}% of this month's dues`}
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  covered ? "bg-success" : "bg-warning",
                )}
                style={{ width: `${share * 100}%` }}
              />
            </div>
            <p
              className={cn(
                "text-sm",
                covered ? "text-success" : "text-danger",
              )}
            >
              {covered
                ? `Covered by your ${formatINR(liquid)} in liquid savings.`
                : `${formatINR(-after)} more than your ${formatINR(liquid)} in liquid savings.`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing left to pay this month.
          </p>
        )}
        {monthlyOut > 0 && months !== null && (
          <p className="rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
            {months > 0
              ? `After these, your liquid savings would last about ${months.toLocaleString("en-IN")} ${months === 1 ? "month" : "months"} at ${formatINR(monthlyOut)} a month (costs and EMIs).`
              : `Nothing would be left for next month's ${formatINR(monthlyOut)} of costs and EMIs.`}
          </p>
        )}
        {payments.length > 0 && (
          <ul className="divide-y border-t" aria-label="Payments due">
            {payments.map((p) => {
              const d = dueLabel(p.date, today);
              return (
                <li
                  key={p.key}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium">
                      {p.name}
                    </span>
                    <span className="tabular block text-sm">
                      {formatINR(p.amount)}{" "}
                      <span
                        className={cn(
                          "text-xs",
                          d.tone === "danger"
                            ? "text-danger"
                            : d.tone === "warning"
                              ? "text-warning"
                              : "text-muted-foreground",
                        )}
                      >
                        · {d.text}
                      </span>
                    </span>
                    {p.statementMonth && (
                      <span className="block text-[11px] text-muted-foreground">
                        {monthYear(p.statementMonth)} statement
                      </span>
                    )}
                  </span>
                  <CreditPaymentButton
                    payment={
                      p.kind === "bill"
                        ? {
                            kind: "bill",
                            id: p.billId!,
                            label: `${p.name} ${monthYear(p.statementMonth!)} bill`,
                          }
                        : {
                            kind: "emi",
                            id: p.loanId!,
                            date: p.date!,
                            label: `${p.name} EMI`,
                          }
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground">
          Card bills and EMIs, overdue or due this month. Liquid savings are
          savings accounts, FDs and liquid funds, including ones set aside for
          goals.
        </p>
      </section>
    </CreditPaymentProvider>
  );
}
