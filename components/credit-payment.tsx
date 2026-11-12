"use client";

import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBillPaid } from "@/lib/cards-actions";
import { markEmiPaid, undoEmiPaid } from "@/lib/loans-actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { todayIST } from "@/lib/dates";
import { monthYear } from "@/lib/goal-summary";

type Payment =
  | { kind: "bill"; id: string; label: string }
  | { kind: "emi"; id: string; date: string; label: string };
type Result = { ok: boolean; error?: string };
const PaymentContext = createContext<{
  pending: boolean;
  pay: (payment: Payment) => void;
} | null>(null);

/** Payments confirm with a toast, which survives the paid row leaving. */
export function CreditPaymentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>, after: () => void) =>
    start(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          toast({
            text: result.error ?? "Could not save. Try again.",
            tone: "danger",
          });
          return;
        }
        after();
        router.refresh();
      } catch {
        toast({
          text: "Could not save. Check your connection and try again.",
          tone: "danger",
        });
      }
    });
  const pay = (p: Payment) =>
    run(
      () =>
        p.kind === "bill"
          ? setBillPaid({ id: p.id, paid: true })
          : markEmiPaid({ loanId: p.id, dueDate: p.date }),
      () =>
        toast({
          text: `${p.label} marked paid.`,
          tone: "success",
          action: {
            label: "Undo",
            onClick: () =>
              run(
                () =>
                  p.kind === "bill"
                    ? setBillPaid({ id: p.id, paid: false })
                    : undoEmiPaid({ loanId: p.id, dueDate: p.date }),
                () => toast({ text: "Undone." }),
              ),
          },
        }),
    );
  return (
    <PaymentContext.Provider value={{ pending, pay }}>
      {children}
    </PaymentContext.Provider>
  );
}

export function CreditPaymentButton({
  payment,
  text = "Mark paid",
}: {
  payment: Payment;
  text?: string;
}) {
  const ctx = useContext(PaymentContext);
  if (!ctx) throw new Error("Credit payments need their provider");
  // An EMI can be marked paid from the 1st of the month it's due.
  if (payment.kind === "emi" && todayIST() < `${payment.date.slice(0, 7)}-01`)
    return (
      <span className="shrink-0 text-xs text-muted-foreground">
        Mark paid from 1 {monthYear(payment.date).split(" ")[0]}
      </span>
    );
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="relative z-10 min-h-11 shrink-0"
      disabled={ctx.pending}
      aria-label={`Mark ${payment.label} paid`}
      onClick={() => ctx.pay(payment)}
    >
      {ctx.pending ? "Saving…" : text}
    </Button>
  );
}
