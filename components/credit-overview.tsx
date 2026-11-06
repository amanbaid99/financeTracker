"use client";

import { useState } from "react";
import { CardList } from "@/components/card-list";
import { LoanList } from "@/components/loan-list";
import {
  CreditPaymentButton,
  CreditPaymentProvider,
} from "@/components/credit-payment";
import { creditPayments } from "@/lib/credit-payments";
import { dueLabel, type Card } from "@/lib/cards";
import type { Loan } from "@/lib/loans";
import { monthYear } from "@/lib/goal-summary";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CreditOverview({
  cards,
  loans,
  today,
  initialOpen,
  action,
}: {
  cards: Card[];
  loans: Loan[];
  today: string;
  initialOpen: string | null;
  action: string | null;
}) {
  const [cardOpen, setCardOpen] = useState(initialOpen);
  const [showAll, setShowAll] = useState(false);
  const payments = creditPayments(cards, loans, today);
  const shown = showAll ? payments : payments.slice(0, 3);
  return (
    <CreditPaymentProvider>
      {/* Only when something is due: cards, then loans, otherwise. */}
      {payments.length > 0 && (
        <section
          className="surface-card rounded-2xl border bg-card p-4"
          aria-labelledby="payments-h"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="payments-h" className="font-semibold">
              Payments due
            </h2>
            <span className="text-xs text-muted-foreground">
              {payments.filter((p) => p.kind !== "linked").length} to record
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Overdue and due this month
          </p>
          {payments.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No overdue or current-month payments to record.
            </p>
          ) : (
            <ul className="mt-2 divide-y" aria-label="Payments due">
              {shown.map((p) => {
                const due = dueLabel(p.date, today);
                return (
                  <li
                    key={p.key}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="break-words text-sm font-medium">
                        {p.name}
                      </p>
                      <p
                        className={cn(
                          "tabular mt-0.5 text-sm",
                          due.tone === "danger"
                            ? "text-danger"
                            : due.tone === "warning"
                              ? "text-warning"
                              : "text-muted-foreground",
                        )}
                      >
                        {formatINR(p.amount)} ·{" "}
                        {p.kind === "linked"
                          ? "Included in card bill"
                          : due.text}
                      </p>
                      {(p.date || p.statementMonth) && (
                        <p className="text-xs text-muted-foreground">
                          {p.statementMonth
                            ? `${monthYear(p.statementMonth)} statement${p.date ? ` · ${formatDate(p.date)}` : ""}`
                            : `${formatDate(p.date)} · EMI`}
                        </p>
                      )}
                    </div>
                    {p.kind === "linked" ? (
                      <button
                        type="button"
                        className="min-h-11 px-2 text-xs font-medium text-primary"
                        onClick={() => {
                          setCardOpen(p.cardId!);
                          requestAnimationFrame(() =>
                            document
                              .getElementById("credit-cards")
                              ?.scrollIntoView({ block: "start" }),
                          );
                        }}
                      >
                        View card
                      </button>
                    ) : (
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
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {payments.length > 3 && (
            <button
              type="button"
              className="min-h-11 w-full text-sm font-medium text-primary"
              aria-expanded={showAll}
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show fewer" : `View all ${payments.length}`}
            </button>
          )}
          {loans.some((l) => l.type === "card" && l.cardId) && (
            <p className="mt-2 text-xs text-muted-foreground">
              Card-loan EMIs are part of card bills. Record those EMIs under
              Loans to update their loan balances.
            </p>
          )}
        </section>
      )}

      <section
        id="credit-cards"
        aria-labelledby="cards-h"
        className="scroll-mt-16 space-y-3"
      >
        <h2 id="cards-h" className="text-lg font-semibold">
          Cards
        </h2>
        <CardList
          cards={cards}
          today={today}
          initialOpen={initialOpen}
          openCardId={cardOpen}
          onOpenChange={setCardOpen}
          action={action}
        />
      </section>
      <LoanList
        loans={loans}
        cards={cards.map((c) => ({ id: c.id, label: c.label }))}
        today={today}
      />
    </CreditPaymentProvider>
  );
}
