"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { setBillPaid } from "@/lib/cards-actions";
import { markEmiPaid, undoEmiPaid } from "@/lib/loans-actions";
import { Button } from "@/components/ui/button";
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

/** Confirmation survives a paid row disappearing after refresh. */
export function CreditPaymentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{
    label: string;
    undo: () => Promise<Result>;
  } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 10000);
    return () => clearTimeout(timer);
  }, [notice]);
  const run = (fn: () => Promise<Result>, after: () => void) =>
    start(async () => {
      setError("");
      try {
        const result = await fn();
        if (!result.ok) {
          setError(result.error ?? "Could not save. Try again.");
          return;
        }
        after();
        router.refresh();
      } catch {
        setError("Could not save. Check your connection and try again.");
      }
    });
  const pay = (p: Payment) =>
    run(
      () =>
        p.kind === "bill"
          ? setBillPaid({ id: p.id, paid: true })
          : markEmiPaid({ loanId: p.id, dueDate: p.date }),
      () =>
        setNotice({
          label: `${p.label} marked paid.`,
          undo: () =>
            p.kind === "bill"
              ? setBillPaid({ id: p.id, paid: false })
              : undoEmiPaid({ loanId: p.id, dueDate: p.date }),
        }),
    );
  return (
    <PaymentContext.Provider value={{ pending, pay }}>
      {notice && (
        <div
          className="sticky top-14 z-40 flex items-center justify-between gap-3 rounded-xl bg-success-soft px-4 py-2 text-sm text-success"
          role="status"
        >
          <span>
            {notice.label}{" "}
            <span className="text-xs">Undo is available for 10 seconds.</span>
          </span>
          <button
            type="button"
            className="min-h-11 shrink-0 px-2 font-semibold underline"
            disabled={pending}
            onClick={() => run(notice.undo, () => setNotice(null))}
          >
            Undo
          </button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="sticky top-14 z-40 rounded-xl bg-danger-soft p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
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
