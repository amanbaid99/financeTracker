import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { RunwayEditor } from "@/components/runway-editor";
import { isLiquid } from "@/lib/categories";
import { loadGoals, loadRunway } from "@/lib/data";

export const metadata: Metadata = { title: "Covered till salary" };

export default async function RunwayPage() {
  const [r, { investments }] = await Promise.all([loadRunway(), loadGoals()]);
  const liquid = investments
    .filter((i) => isLiquid(i.kind, i.category) && i.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((i) => ({ name: i.name ?? "Savings", value: i.value }));
  return (
    <main className="space-y-4">
      <BackLink fallback="/goals" label="Goals" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Covered till salary
        </h1>
        <p className="text-sm text-muted-foreground">
          Between jobs: what you have, what&apos;s due before your salary, and
          what&apos;s safe to spend each week.
        </p>
      </div>
      <RunwayEditor
        runway={r.runway}
        items={r.items}
        liquidHoldings={liquid}
        salaryBest={r.salaryBest}
        salaryWorst={r.salaryWorst}
        active={r.active}
        monthlyLiving={r.monthlyLiving}
      />
    </main>
  );
}
