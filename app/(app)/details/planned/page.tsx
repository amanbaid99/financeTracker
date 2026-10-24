import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlannedForm } from "@/components/forms/planned-form";
import { loadRaw } from "@/lib/data";

export const metadata: Metadata = { title: "Planned expenses" };

export default async function PlannedPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const raw = await loadRaw();
  const back = from === "budget" ? "/budget" : from === "month" ? "/month" : "/details";
  return (
    <main className="mx-auto max-w-xl space-y-5">
      <Link href={back} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Back
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Planned expenses</h1>
      <PlannedForm
        next={back}
        initial={raw.planned.map((p) => ({
          id: p.id,
          name: p.name,
          amount: p.amount,
          everyMonths: p.every_months,
          nextDue: p.next_due ?? "",
          inBudget: p.in_budget,
        }))}
      />
    </main>
  );
}
