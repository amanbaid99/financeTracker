import type { Metadata } from "next";
import { CreditOverview } from "@/components/credit-overview";
import { loadCards, loadLoans } from "@/lib/data";
import { cardEmis } from "@/lib/loans";

export const metadata: Metadata = { title: "Cards" };

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; do?: string }>;
}) {
  const [{ cards, today }, loans, { open, do: action }] = await Promise.all([
    loadCards(),
    loadLoans(),
    searchParams,
  ]);
  // EMIs of loans on a card are part of its bills but not milestone spend.
  const withEmis = cards.map((c) => ({
    ...c,
    emiPerBill: cardEmis(loans, c.id, today),
  }));
  return (
    <main className="space-y-4">
      <CreditOverview
        cards={withEmis}
        today={today}
        initialOpen={open ?? null}
        action={action ?? null}
      />
    </main>
  );
}
