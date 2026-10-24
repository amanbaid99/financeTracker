"use client";

import { useOptimistic, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { setBillPaid } from "@/lib/actions";
import type { Bill } from "@/lib/bills";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<Bill["kind"], string> = {
  card: "Card",
  emi: "EMI",
  insurance: "Insurance",
  planned: "Planned",
  sip: "SIP",
};

export function MonthBills({ bills, paidKeys, month }: { bills: Bill[]; paidKeys: string[]; month: string }) {
  const [, start] = useTransition();
  const [paid, setPaid] = useOptimistic(new Set(paidKeys), (state, { key, value }: { key: string; value: boolean }) => {
    const next = new Set(state);
    if (value) next.add(key);
    else next.delete(key);
    return next;
  });
  const total = bills.reduce((s, b) => s + b.amount, 0);
  const done = bills.filter((b) => paid.has(b.key)).reduce((s, b) => s + b.amount, 0);

  if (bills.length === 0) {
    return <p className="text-sm text-muted-foreground">No bills this month yet. Add cards, loans, insurance or planned expenses.</p>;
  }

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Due this month</dt>
          <dd className="tabular font-semibold">{formatINR(total)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Paid</dt>
          <dd className="tabular font-semibold">{formatINR(done)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Still to pay</dt>
          <dd className="tabular font-semibold">{formatINR(total - done)}</dd>
        </div>
      </dl>
      <ul className="divide-y rounded-lg border">
        {bills.map((b) => {
          const isPaid = paid.has(b.key);
          return (
            <li key={b.key}>
              <label className="flex cursor-pointer items-center gap-3 p-3">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-[var(--primary)]"
                  checked={isPaid}
                  aria-label={`Mark ${b.label} as paid`}
                  onChange={(e) => {
                    const value = e.target.checked;
                    start(async () => {
                      setPaid({ key: b.key, value });
                      await setBillPaid({ month, key: b.key, paid: value, plannedId: b.plannedId });
                    });
                  }}
                />
                <div className={cn("min-w-0 flex-1", isPaid && "text-muted-foreground line-through")}>
                  <p className="truncate text-sm font-medium">{b.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.dueDate ? `Due ${formatDate(b.dueDate)}` : "This month"}
                    {b.overdue && !isPaid ? " · overdue" : ""}
                  </p>
                </div>
                <Badge variant="muted" className="hidden sm:inline-flex">
                  {KIND_LABEL[b.kind]}
                </Badge>
                <span className={cn("tabular text-sm", isPaid && "text-muted-foreground line-through")}>
                  {formatINR(b.amount)}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
