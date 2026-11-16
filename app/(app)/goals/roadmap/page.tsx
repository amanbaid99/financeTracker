import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { RoadmapView } from "@/components/roadmap-view";
import { loadGoals, loadLoans, loadRunway } from "@/lib/data";
import { roadmap } from "@/lib/roadmap";

export const metadata: Metadata = { title: "Roadmap" };

export default async function RoadmapPage() {
  const [{ goals, today }, loans, r] = await Promise.all([
    loadGoals(),
    loadLoans(),
    loadRunway(),
  ]);
  const covered = r.runway
    ? r.runway.worst.left >= 0
      ? true
      : r.runway.worst.leftWithOwed >= 0
        ? null
        : false
    : null;
  const map = roadmap({
    today,
    goals,
    loans,
    salary:
      r.active && r.salaryBest && r.salaryWorst
        ? { best: r.salaryBest, worst: r.salaryWorst, covered }
        : null,
  });
  return (
    <main className="space-y-4">
      <BackLink fallback="/goals" label="Goals" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Roadmap</h1>
        <p className="text-sm text-muted-foreground">
          Your plan, step by step. Green is on plan, grey is waiting for salary,
          amber needs you. Tap a step for details.
        </p>
      </div>
      <RoadmapView map={map} today={today} />
    </main>
  );
}
