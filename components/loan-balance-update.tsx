"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import type { Loan } from "@/lib/loans";
import { formatDate, formatINR } from "@/lib/format";
import { confirmLoanBalance } from "@/lib/updates-actions";

export function LoanBalanceUpdate({ loan }: { loan: Loan }) {
  // Leave blank so a projected or stale figure cannot be silently confirmed.
  const [balance, setBalance] = useState<number | null>(null);
  const [principal, setPrincipal] = useState(loan.principal);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <form
      className="rounded-2xl border bg-card p-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (balance === null) return;
        start(async () => {
          setError("");
          const result = await confirmLoanBalance({
            id: loan.id,
            outstanding: balance,
            principal,
          });
          if (!result.ok) setError(result.error ?? "Try again.");
          else {
            router.push("/goals");
            router.refresh();
          }
        });
      }}
    >
      <h2 className="font-semibold">{loan.name}</h2>
      <p className="text-sm text-muted-foreground">
        Last saved: {formatINR(loan.outstanding)} on{" "}
        {formatDate(loan.confirmedOn ?? loan.asOf)}
        {!loan.confirmedOn &&
          ". Based on the loan schedule; confirm with your lender"}
        .
      </p>
      <Field label="Amount borrowed (optional)" htmlFor="borrowed">
        <MoneyInput id="borrowed" value={principal} onChange={setPrincipal} />
      </Field>
      <Field
        label="Outstanding amount now"
        htmlFor="outstanding"
        hint="Enter the principal outstanding shown by your lender. Enter 0 if closed."
      >
        <MoneyInput
          id="outstanding"
          value={balance}
          onChange={setBalance}
          required
        />
      </Field>
      {principal !== null && balance !== null && (
        <p className="text-sm">
          Principal repaid: {formatINR(Math.max(0, principal - balance))}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        This balance stays until you update it again. Future EMI and payoff
        figures are estimates. This does not mark a payment paid.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || balance === null}>
        {pending ? "Saving…" : "Confirm balance"}
      </Button>
    </form>
  );
}
