import type { Metadata } from "next";
import { GoalForm } from "@/components/forms/goal-form";
import { Card, CardContent } from "@/components/ui/card";
import { loadAnalysis } from "@/lib/data";
import { suggestRetirement } from "@/lib/engine/goals";
import type { GoalType } from "@/lib/engine/types";
import { goalState } from "@/lib/form-state";
import { GOAL_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "New goal" };

export default async function NewGoalPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const { analysis, data, today } = await loadAnalysis();
  const goalType = (type && type in GOAL_TYPE_LABELS ? type : "custom") as GoalType;
  const initial = goalState(null, today, goalType);
  if (goalType === "retirement") {
    const s = suggestRetirement(analysis.budget.essentials.total * 12, data.profile.age, today, analysis.config);
    initial.name = "Retirement";
    initial.targetToday = s.targetToday || null;
    if (s.targetDate) initial.targetDate = s.targetDate;
  }
  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">New goal</h1>
      <Card>
        <CardContent className="pt-5 sm:pt-5">
          <GoalForm
            initial={initial}
            defaultInflation={analysis.config.goals.inflationByType}
            afterSave="goal"
            cancelHref="/goals"
          />
        </CardContent>
      </Card>
    </main>
  );
}
