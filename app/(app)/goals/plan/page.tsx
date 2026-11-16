import { ArrowUpDown, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { PlanView } from "@/components/plan-view";
import { buttonVariants } from "@/components/ui/button";
import { loadMoneyPlan, loadRunway } from "@/lib/data";

export const metadata: Metadata = { title: "Your plan" };

/** How your monthly money is split across goals, in your order. */
export default async function PlanPage() {
  const [d, r] = await Promise.all([loadMoneyPlan(), loadRunway()]);
  return (
    <main className="space-y-5">
      <BackLink fallback="/goals" label="Goals" />
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Your plan</h1>
          <Link
            href="/goals/order"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowUpDown /> Edit order
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          How your monthly money is split across goals, top of your order first.
        </p>
      </div>
      <Link
        href="/goals?do=extra"
        className="inline-flex min-h-10 items-center text-sm font-medium text-primary"
      >
        I have extra money
      </Link>
      {d.plan ? (
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
      ) : (
        <div className="surface-card space-y-3 rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {r.active
              ? "No monthly split yet. That's fine while you're between jobs: make one once your salary starts."
              : "No monthly split yet. Tell the app what you can invest each month, and it splits it across your goals."}
          </p>
          <Link
            href="/goals?do=plan"
            className={buttonVariants({
              variant: r.active ? "outline" : "default",
            })}
          >
            <Sparkles /> Make a plan
          </Link>
        </div>
      )}
    </main>
  );
}
