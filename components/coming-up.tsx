"use client";

import { CalendarClock, Landmark, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CreditPaymentButton } from "@/components/credit-payment";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatINR } from "@/lib/format";
import type { Upcoming } from "@/lib/liabilities";
import { setRunwayItemDone } from "@/lib/runway-actions";

const MONTHS =
  "January February March April May June July August September October November December".split(
    " ",
  );
const monthOf = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
const dayMonth = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
};

const ICONS = { emi: Landmark, item: Receipt, bill: Wallet };

function ItemPaid({ u }: { u: Upcoming }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const set = (done: boolean) =>
    start(async () => {
      const res = await setRunwayItemDone(u.itemId!, done);
      if (!res.ok) {
        toast({ text: res.error ?? "Could not save.", tone: "danger" });
        return;
      }
      if (done)
        toast({
          text: `${u.label} paid. Update your bank balance when you can.`,
          tone: "success",
          action: { label: "Undo", onClick: () => set(false) },
        });
      router.refresh();
    });
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="min-h-11 shrink-0"
      disabled={pending}
      aria-label={`Mark ${u.label} paid`}
      onClick={() => set(true)}
    >
      {pending ? "Saving…" : "Paid"}
    </Button>
  );
}

/** Everything due, by month, with a way to mark each one paid. */
export function ComingUp({
  items,
  until,
  total,
  between,
}: {
  items: Upcoming[];
  until: string;
  total: number;
  between: boolean;
}) {
  const months = [...new Set(items.map((u) => monthOf(u.date)))];
  return (
    <section
      aria-labelledby="coming-up-h"
      data-guide="coming-up"
      className="surface-card space-y-3 rounded-2xl border border-border/70 bg-card p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="coming-up-h" className="text-lg font-semibold">
          Coming up
        </h2>
        {total > 0 && (
          <span className="tabular text-sm font-medium">
            {formatINR(total)}
          </span>
        )}
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        {between
          ? `Everything due till your salary, ${dayMonth(until)}.`
          : `Everything due till ${dayMonth(until)}.`}
      </p>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <CalendarClock className="size-4" aria-hidden /> Nothing due. Enjoy
          the quiet.
        </p>
      ) : (
        months.map((m) => {
          const rows = items.filter((u) => monthOf(u.date) === m);
          return (
            <div key={m} className="space-y-1">
              <h3 className="flex items-baseline justify-between border-b pb-1 text-xs font-medium text-muted-foreground">
                <span>{m}</span>
                <span className="tabular">
                  {formatINR(rows.reduce((s, u) => s + u.amount, 0))}
                </span>
              </h3>
              <ul className="divide-y" aria-label={`Due in ${m}`}>
                {rows.map((u) => {
                  const Icon = ICONS[u.source];
                  return (
                    <li key={u.key} className="flex items-center gap-3 py-2.5">
                      <span
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                        aria-hidden
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-medium">
                          {u.label}
                        </span>
                        <span className="tabular block text-xs text-muted-foreground">
                          {u.undated ? "No date" : dayMonth(u.date)} ·{" "}
                          {formatINR(u.amount)}
                        </span>
                      </span>
                      {u.source === "emi" && u.loanId ? (
                        <CreditPaymentButton
                          payment={{
                            kind: "emi",
                            id: u.loanId,
                            date: u.date,
                            label: u.label,
                          }}
                          text="Paid"
                        />
                      ) : u.source === "item" && u.itemId ? (
                        <ItemPaid u={u} />
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          From a bills fund
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}
      <Link
        href="/liabilities/salary"
        className="-mb-1 flex min-h-11 items-center border-t pt-1 text-sm font-medium text-primary"
      >
        {between
          ? "Due till salary, in detail"
          : "Add a payment, like card dues"}
      </Link>
    </section>
  );
}
