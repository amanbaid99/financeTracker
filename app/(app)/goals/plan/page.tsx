import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlanView } from "@/components/plan-view";
import { loadMoneyPlan } from "@/lib/data";

export const metadata: Metadata = { title: "Your money plan" };

export default async function PlanPage() {
  const d = await loadMoneyPlan();
  // No plan yet: Goals has the form to make one.
  if (!d.plan) redirect("/goals?do=plan");
  return (
    <main className="space-y-5">
      <Link
        href="/goals"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> Goals
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your money plan
        </h1>
        <p className="text-sm text-muted-foreground">
          How your monthly money is split across goals, and what to add to your
          SIPs.
        </p>
      </div>
      <PlanView
        plan={d.plan}
        budget={d.budget}
        goals={d.goals}
        investments={d.investments}
        links={d.links}
        sipsNow={d.sipsNow}
        unassigned={d.unassigned}
        budgetMonthly={d.budgetMonthly}
      />
    </main>
  );
}
