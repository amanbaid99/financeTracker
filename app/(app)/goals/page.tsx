import {redirect} from "next/navigation";
import { Plus } from "lucide-react";
import { GuideButton } from "@/components/guides";
import type { Metadata } from "next";
import Link from "next/link";
import { ExtraMoney } from "@/components/extra-money";
import { GoalsOverview } from "@/components/goals-overview";
import { UpdateButton } from "@/components/update-values";
import { buttonVariants } from "@/components/ui/button";
import { loadMoneyPlan, loadRunway } from "@/lib/data";
import { sortGoals } from "@/lib/goal-summary";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; do?: string }>;
}) {
  const { open, do: action } = await searchParams;
  if(action==="plan")redirect("/goals/sip");
  const {
    goals,
    investments,
    links,
    today,
    plan,
    budget: monthBudget,
    sipsNow,
    unassigned,
    budgetMonthly,
  } = await loadMoneyPlan();
  const between=await loadRunway();
  // Every investment remains updatable from the + menu.
  const goalNames = new Map(goals.map((g) => [g.id, g.name]));
  const updatable = investments.map((i) => ({
    investment: i,
    goals: links
      .filter((l) => l.investmentId === i.id)
      .map((l) => goalNames.get(l.goalId) ?? ""),
  }));

  return (
    <main className="space-y-4">
      <div className="space-y-4">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
              <GuideButton id="goals" />
            </div>
            {goals.length > 0 && plan && (
              <Link
                href="/goals/plan"
                data-guide="plan-link"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Your plan
              </Link>
            )}
          </div>

        </div>
      </div>

      {updatable.length > 0 && (
        <UpdateButton
          items={updatable}
          autoOpen={action === "update"}
          showButton={false}
        />
      )}

      {goals.length===0&&<ExtraMoney goals={goals} investments={investments} links={links} today={today} plan={plan} sipsNow={sipsNow} autoOpen={action==="extra"} />}
      {goals.length === 0 ? (
        <div className="space-y-3 rounded-2xl border bg-card p-6 text-center">
          <p className="text-lg font-semibold">What are you saving for?</p>
          <p className="text-sm text-muted-foreground">
            Add a goal and your investments, and the app shows if
            you&apos;ll get there on time.
          </p>
          <Link href="/goals/new" className={buttonVariants()}>
            <Plus /> Add your first goal
          </Link>

        </div>
      ) : (
        <>
          <GoalsOverview
            budget={monthBudget}
            suggestions={plan?.suggestions ?? []}
            goals={sortGoals(goals)}
            investments={investments}
            links={links}
            today={today}
            initialOpen={open ?? null}
            plan={plan}
            sipsNow={sipsNow}
            unassigned={unassigned}
            autoOpen={action === "plan"}
            autoExtra={action === "extra"}
            budgetMonthly={budgetMonthly}
            between={between.active}
          />
        </>
      )}
    </main>
  );
}
