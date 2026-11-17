"use client";

import { useState } from "react";
import { CardList } from "@/components/card-list";
import { CreditPaymentProvider } from "@/components/credit-payment";
import type { Card } from "@/lib/cards";

/**
 * Cards: statements logged for milestones only, never as money owed. Loans
 * live in goals.
 */
export function CreditOverview({
  cards,
  today,
  initialOpen,
  action,
}: {
  cards: Card[];
  today: string;
  initialOpen: string | null;
  action: string | null;
}) {
  const [cardOpen, setCardOpen] = useState(initialOpen);
  return (
    <CreditPaymentProvider>
      <section
        id="credit-cards"
        data-guide="cards"
        aria-label="Your cards"
        className="scroll-mt-16"
      >
        <CardList
          cards={cards}
          today={today}
          initialOpen={initialOpen}
          openCardId={cardOpen}
          onOpenChange={setCardOpen}
          action={action}
        />
      </section>
    </CreditPaymentProvider>
  );
}
