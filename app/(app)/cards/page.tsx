import type { Metadata } from "next";
import { GuideButton } from "@/components/guides";
import { CardList } from "@/components/card-list";
import { LoanList } from "@/components/loan-list";
import { loadCards, loadLoans } from "@/lib/data";
import { cardEmis } from "@/lib/loans";

export const metadata: Metadata = { title: "Credit" };

export default async function CreditPage({
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
    <main className="space-y-6">
      <div>
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Credit</h1>
          <GuideButton id="cards" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Loans and cards: what&apos;s due comes first.
        </p>
      </div>
      <LoanList
        loans={loans}
        cards={cards.map((c) => ({ id: c.id, label: c.label }))}
        today={today}
      />
      <section aria-labelledby="cards-h" className="space-y-3">
        <h2 id="cards-h" className="text-lg font-semibold">
          Cards
        </h2>
        <CardList
          cards={withEmis}
          today={today}
          initialOpen={open ?? null}
          action={action ?? null}
        />
      </section>
    </main>
  );
}
