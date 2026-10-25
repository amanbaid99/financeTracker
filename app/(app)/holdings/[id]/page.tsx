import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AllocationEditor } from "@/components/forms/allocation-editor";
import { HoldingForm } from "@/components/forms/holding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAnalysis } from "@/lib/data";
import { HOLDING_KIND_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Holding" };

export default async function EditHoldingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { raw, analysis } = await loadAnalysis();
  const h = raw.holdings.find((x) => x.id === id);
  if (!h) notFound();
  const allocs = raw.allocations.filter((a) => a.holding_id === id);
  const goal =
    allocs.length === 0 ? "none" : allocs.length === 1 && Number(allocs[0].percent) === 100 ? allocs[0].goal_id : "split";
  const goals = raw.goals.map((g) => ({ id: g.id, name: g.name }));
  const label = h.name || HOLDING_KIND_LABELS[h.kind];

  return (
    <main className="mx-auto max-w-xl space-y-4">
      <Link href="/holdings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Holdings
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>
      <Card>
        <CardContent className="pt-5 sm:pt-5">
          <HoldingForm
            goals={goals}
            defaultReturns={analysis.config.goals.returnByCategory}
            initial={{
              id: h.id,
              kind: h.kind,
              name: h.name ?? "",
              category: h.category ?? "other",
              currentValue: h.current_value,
              monthlySip: h.monthly_sip,
              sipStepUpPct: h.sip_step_up_pct === null ? "" : String(Number(h.sip_step_up_pct)),
              expectedReturn: h.expected_return_pct === null ? "" : String(Number(h.expected_return_pct)),
              goal,
            }}
          />
        </CardContent>
      </Card>
      {goals.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Split across goals</CardTitle>
            <CardDescription>
              Optional. Use this if one holding serves more than one goal, e.g. 60% house and 40% retirement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationEditor
              holdingId={h.id}
              holdingLabel={label}
              goals={goals}
              initial={allocs.map((a) => ({ goalId: a.goal_id, percent: Number(a.percent) }))}
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
