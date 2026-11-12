import { BackLink } from "@/components/back-link";
import type { Metadata } from "next";
import { NewGoal } from "@/components/new-goal";
import { todayIST } from "@/lib/dates";

export const metadata: Metadata = { title: "New goal" };

export default function NewGoalPage() {
  return (
    <main className="space-y-4">
      <BackLink fallback="/goals" label="Your goals" />
      <h1 className="text-2xl font-semibold tracking-tight">New goal</h1>
      <NewGoal today={todayIST()} />
    </main>
  );
}
