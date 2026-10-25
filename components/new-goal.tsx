"use client";

import { useRouter } from "next/navigation";
import { GoalForm } from "@/components/goal-form";

export function NewGoal({ today }: { today: string }) {
  const router = useRouter();
  return <GoalForm goal={null} today={today} onSaved={(id) => router.push(`/goals/${id}`)} />;
}
