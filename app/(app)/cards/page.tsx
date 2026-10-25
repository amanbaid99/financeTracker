import type { Metadata } from "next";
import { CardList } from "@/components/card-list";
import { loadCards } from "@/lib/data";

export const metadata: Metadata = { title: "Credit cards" };

export default async function CardsPage() {
  const { cards, today } = await loadCards();
  return (
    <main className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Credit cards</h1>
        <p className="text-sm text-muted-foreground">
          Benefits, rewards and spend milestones for each card.
        </p>
      </div>
      <CardList cards={cards} today={today} />
    </main>
  );
}
