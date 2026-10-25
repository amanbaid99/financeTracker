import { ChevronRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { AddBankAccount, PurposeSelect } from "@/components/bank-panel";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import type { Bill } from "@/lib/bills";
import { formatDate, formatINR } from "@/lib/format";
import type { MonthStatus } from "@/lib/month-status";
import { cn } from "@/lib/utils";

function billWhen(b: Bill): string {
  if (b.status === "not_generated") return "Not generated yet";
  if (b.status === "overdue") return `Overdue · ${formatDate(b.dueDate)}`;
  if (b.dueDate) return `Due ${formatDate(b.dueDate)}`;
  return "This month";
}

/** Home screen: bank balances by purpose, what's due, and what's left. */
export function MoneyNowCard({ status }: { status: MonthStatus }) {
  const paid = new Set(status.paidKeys);
  const next = status.bills
    .filter((b) => !paid.has(b.key) && b.kind !== "sip")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 3);
  const headline = status.hasSpendingAccounts ? status.spendingLeft : status.left;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Your money right now</CardTitle>
          <Link href="/update" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <RefreshCw className="size-3.5" aria-hidden /> Update
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {status.hasSpendingAccounts ? "Spending money left this month" : "Left after this month's dues"}
            <InfoTip
              text={
                status.hasSpendingAccounts
                  ? "What's in your spending and bills accounts after card bills and everything else still due this month."
                  : "Your bank balance after card bills and everything else still due this month. Mark accounts as Spending to see spending money separately."
              }
            />
          </p>
          <p className={cn("tabular text-3xl font-semibold tracking-tight", headline < 0 && "text-danger")}>
            {formatINR(headline)}
          </p>
          {headline < 0 && (
            <p className="mt-1 text-xs text-danger">
              Not enough to cover what&apos;s due. Pay card bills first to avoid interest.
            </p>
          )}
        </div>

        <dl className="divide-y rounded-lg border text-sm">
          <div className="flex justify-between p-2.5">
            <dt>In the bank</dt>
            <dd className="tabular font-medium">{formatINR(status.bankTotal)}</dd>
          </div>
          {status.hasSpendingAccounts && (
            <div className="flex justify-between p-2.5 text-muted-foreground">
              <dt className="pl-3">Spending · Bills · Savings</dt>
              <dd className="tabular">
                {formatINR(status.byPurpose.spending)} · {formatINR(status.byPurpose.bills)} ·{" "}
                {formatINR(status.byPurpose.savings)}
              </dd>
            </div>
          )}
          <div className="flex justify-between p-2.5">
            <dt>Card bills to pay</dt>
            <dd className="tabular font-medium">-{formatINR(status.cardUnpaid)}</dd>
          </div>
          <div className="flex justify-between p-2.5">
            <dt>Other bills still due</dt>
            <dd className="tabular font-medium">-{formatINR(status.otherUnpaid)}</dd>
          </div>
          {status.hasSpendingAccounts && (
            <div className="flex justify-between p-2.5 text-muted-foreground">
              <dt>Total left, including savings</dt>
              <dd className="tabular">{formatINR(status.left)}</dd>
            </div>
          )}
        </dl>

        {next.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Coming up</p>
            <ul className="space-y-1.5 text-sm">
              {next.map((b) => (
                <li key={b.key} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate">{b.label}</span>
                    <span
                      className={cn(
                        "text-xs text-muted-foreground",
                        b.status === "overdue" && "text-danger",
                        b.status === "not_generated" && "text-warning",
                      )}
                    >
                      {billWhen(b)}
                    </span>
                  </span>
                  <span className="tabular shrink-0">
                    {b.amount === null ? (b.estimate ? `~${formatINR(b.estimate)}` : "Not out yet") : formatINR(b.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link href="/month" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
          {status.billsDueCount ? `All bills (${status.billsDueCount} still due)` : "All bills"}{" "}
          <ChevronRight aria-hidden />
        </Link>

        <details className="group rounded-lg border">
          <summary className="flex cursor-pointer list-none items-center justify-between p-2.5 text-sm">
            <span>
              Bank accounts <span className="text-muted-foreground">({status.banks.length})</span>
            </span>
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
          </summary>
          <div className="space-y-2 border-t p-2.5">
            {status.banks.length === 0 && <p className="text-sm text-muted-foreground">No bank accounts yet.</p>}
            <ul className="space-y-2">
              {status.banks.map((b) => (
                <li key={b.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{b.label}</span>
                  <PurposeSelect holdingId={b.id} label={b.label} value={b.purpose} />
                  <span className="tabular w-24 text-right">{formatINR(b.value)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Mark the accounts you spend from as Spending. Only Savings accounts count toward your emergency fund.
            </p>
            <AddBankAccount />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
