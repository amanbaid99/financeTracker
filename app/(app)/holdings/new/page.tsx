import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { HoldingForm } from "@/components/forms/holding-form";
import { Card, CardContent } from "@/components/ui/card";
import { loadAnalysis } from "@/lib/data";

export const metadata: Metadata = { title: "Add holding" };

export default async function NewHoldingPage() {
  const { raw, analysis } = await loadAnalysis();
  return (
    <main className="mx-auto max-w-xl space-y-4">
      <Link href="/holdings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Holdings
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Add a holding</h1>
      <Card>
        <CardContent className="pt-5 sm:pt-5">
          <HoldingForm
            goals={raw.goals.map((g) => ({ id: g.id, name: g.name }))}
            defaultReturns={analysis.config.goals.returnByCategory}
            initial={{
              kind: "savings",
              name: "",
              category: "savings_account",
              currentValue: null,
              monthlySip: null,
              sipStepUpPct: "",
              expectedReturn: "",
              goal: "none",
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
