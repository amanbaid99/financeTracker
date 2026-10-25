import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NewGoal } from "@/components/new-goal";
import { todayIST } from "@/lib/dates";

export const metadata: Metadata = { title: "New goal" };

export default function NewGoalPage() {
  return (
    <main className="space-y-4">
      <Link href="/goals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Your goals
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">New goal</h1>
      <NewGoal today={todayIST()} />
    </main>
  );
}
