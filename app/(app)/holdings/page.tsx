import type { Metadata } from "next";
import { AllocationEditor } from "@/components/forms/allocation-editor";
import { HoldingsForm } from "@/components/forms/holdings-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAnalysis } from "@/lib/data";
import { categoryLabel } from "@/lib/engine/categories";
import { holdingState } from "@/lib/form-state";
import { formatINR, formatINRCompact } from "@/lib/format";
import { HOLDING_KIND_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Holdings" };

export default async function HoldingsPage() {
  const { raw, data } = await loadAnalysis();
  const goals = raw.goals.map((g) => ({ id: g.id, name: g.name }));
  const total = data.holdings.reduce((s, h) => s + h.currentValue, 0);
  const items = data.holdings.map((h) => {
    const allocs = data.allocations.filter((a) => a.holdingId === h.id);
    const pct = allocs.reduce((s, a) => s + a.percent, 0);
    const unassigned = (h.currentValue * Math.max(0, 100 - pct)) / 100;
    return { h, allocs, pct, unassigned };
  });

  const unassignedTotal = items.reduce((s, x) => s + x.unassigned, 0);

  return (
    <main className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Holdings</h1>
        <p className="text-sm text-muted-foreground">
          {formatINRCompact(total)} in total · {formatINRCompact(unassignedTotal)} unassigned
        </p>
      </div>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Map holdings to goals</CardTitle>
            <CardDescription>
              A holding can fund several goals by percentage, up to 100%. Unmapped money shows as unassigned.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {items.map(({ h, allocs, unassigned }) => {
                const label = h.name || HOLDING_KIND_LABELS[h.kind];
                return (
                  <li key={h.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {categoryLabel(h.category)}
                          {h.monthlySip ? ` · SIP ${formatINR(h.monthlySip)}/month` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tabular font-medium">{formatINR(h.currentValue)}</p>
                        {unassigned >= 1 && <Badge variant="muted">{formatINRCompact(unassigned)} unassigned</Badge>}
                      </div>
                    </div>
                    <AllocationEditor
                      holdingId={h.id}
                      holdingLabel={label}
                      goals={goals}
                      initial={allocs.map((a) => ({ goalId: a.goalId, percent: a.percent }))}
                    />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{items.length ? "Edit holdings" : "Add holdings"}</CardTitle>
          <CardDescription>Update values monthly to keep your plan accurate.</CardDescription>
        </CardHeader>
        <CardContent>
          <HoldingsForm
            initial={holdingState(raw)}
            answered={raw.profile.answered_sections.includes("holdings")}
            next="/holdings"
            back={null}
            editing
            optional={false}
            saveLabel="Save holdings"
          />
        </CardContent>
      </Card>
    </main>
  );
}
