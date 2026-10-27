import type { Metadata } from "next";
import { GuideButton } from "@/components/guides";
import { CardList } from "@/components/card-list";
import { loadCards } from "@/lib/data";

export const metadata: Metadata = { title: "Credit cards" };

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; do?: string }>;
}) {
  const [{ cards, today }, { open, do: action }] = await Promise.all([
    loadCards(),
    searchParams,
  ]);
  return (
    <main className="space-y-4">
      <div>
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Cards</h1>
          <GuideButton id="cards" />
        </div>
      </div>
      <CardList
        cards={cards}
        today={today}
        initialOpen={open ?? null}
        action={action ?? null}
      />
    </main>
  );
}
