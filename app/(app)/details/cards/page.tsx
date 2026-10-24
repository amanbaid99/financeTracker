import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CardsForm } from "@/components/forms/cards-form";
import { loadRaw } from "@/lib/data";

export const metadata: Metadata = { title: "Credit cards" };

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const raw = await loadRaw();
  const back = from === "month" ? "/month?tab=bank" : "/details";
  return (
    <main className="mx-auto max-w-xl space-y-5">
      <Link href={back} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Back
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Credit cards</h1>
      <CardsForm
        next={back}
        initial={raw.cards.map((c) => ({
          id: c.id,
          label: c.label,
          outstanding: c.outstanding,
          statementDay: c.statement_day,
          dueDay: c.due_day,
        }))}
      />
    </main>
  );
}
