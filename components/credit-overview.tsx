"use client";

import { useState } from "react";
import { CardList } from "@/components/card-list";
import { LoanList } from "@/components/loan-list";
import { CreditPaymentProvider } from "@/components/credit-payment";
import type { Card } from "@/lib/cards";
import type { Loan } from "@/lib/loans";

/**
 * Credit: cards first (statements logged for milestones only, never as
 * money owed), then loans with their EMIs.
 */
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
  return (
    <CreditPaymentProvider>
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
