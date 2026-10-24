"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { saveGoal } from "@/lib/actions";
import { formatDate, formatINRCompact } from "@/lib/format";
import { GOAL_TYPE_LABELS } from "@/lib/labels";

export interface GoalSummary {
  id: string;
  name: string;
  type: keyof typeof GOAL_TYPE_LABELS;
  targetToday: number;
  targetDate: string | null;
}

export function GoalsStep({
  goals,
  retirement,
  next,
  back,
}: {
  goals: GoalSummary[];
  retirement: { targetToday: number; targetDate: string | null; reason: string };
  next: string;
  back: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const hasRetirement = goals.some((g) => g.type === "retirement");

  function addRetirement() {
    if (!retirement.targetDate) return setError("Add your age in the first step to plan retirement.");
    start(async () => {
      const res = await saveGoal({
        name: "Retirement",
        type: "retirement",
        targetToday: Math.max(1, retirement.targetToday),
        targetDate: retirement.targetDate!,
        priority: 2,
        savedAmount: 0,
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Your emergency fund is already part of your plan, so start with retirement and add anything else you&apos;re
        saving for.
      </p>
      {!hasRetirement && (
        <div className="space-y-3 rounded-xl border border-primary/40 bg-primary-soft/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">Retirement</p>
            <Badge>Suggested</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {retirement.targetToday > 0
              ? `${formatINRCompact(retirement.targetToday)} in today's rupees${
                  retirement.targetDate ? `, by ${formatDate(retirement.targetDate)}` : ""
                }. ${retirement.reason}`
              : "Add your expenses to get a suggested amount, or set your own."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={addRetirement} disabled={pending || retirement.targetToday <= 0}>
              Add retirement goal
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/onboarding/goals?add=retirement")}>
              Set my own amount
            </Button>
          </div>
        </div>
      )}
      {goals.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card">
          {goals.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{g.name}</p>
                <p className="text-muted-foreground">
                  {GOAL_TYPE_LABELS[g.type]} · {g.targetDate ? `by ${formatDate(g.targetDate)}` : "no deadline"}
                </p>
              </div>
              <span className="tabular font-medium">{formatINRCompact(g.targetToday)}</span>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" onClick={() => router.push("/onboarding/goals?add=custom")}>
        Add a goal
      </Button>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <div>
          {back && (
            <Button type="button" variant="ghost" onClick={() => router.push(back)}>
              Back
            </Button>
          )}
        </div>
        <Button type="button" onClick={() => router.push(next)}>
          {goals.length ? "Continue" : "Skip for now"}
        </Button>
      </div>
    </div>
  );
}
