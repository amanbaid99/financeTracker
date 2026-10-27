import { FileUp, Plus } from "lucide-react";
import { GuideButton } from "@/components/guides";
import type { Metadata } from "next";
import Link from "next/link";
import { GoalList } from "@/components/goal-list";
import { MoneyPlanCard } from "@/components/money-plan";
import { UpdateButton } from "@/components/update-values";
import { buttonVariants } from "@/components/ui/button";
import { loadGoals } from "@/lib/data";
import { formatINR, formatINRCompact } from "@/lib/format";
import { planMoney } from "@/lib/allocate";
import { sortGoals } from "@/lib/goal-summary";
import { freePercent } from "@/lib/tracker";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; do?: string }>;
}) {
  const { open, do: action } = await searchParams;
  const {
    goals,
    investments,
    links,
    today,
    plan: planInput,
  } = await loadGoals();
  const sipsNow = investments.reduce((s, i) => s + i.monthlySip, 0);
  const unassigned = Math.round(
    investments.reduce(
      (s, i) => s + (i.value * freePercent(i.id, links)) / 100,
      0,
    ),
  );
  const plan = planInput
    ? planMoney({
        goals,
        investments,
        links,
        lump: planInput.lump,
        monthlyTotal: planInput.monthly,
        todayISO: today,
      })
    : null;
  const saved = goals.reduce((s, g) => s + g.current, 0);
  const sips = goals.reduce((s, g) => s + g.monthlySip, 0);
  // Investments on at least one goal, with the goals they count toward.
  const goalNames = new Map(goals.map((g) => [g.id, g.name]));
  const updatable = investments
    .map((i) => ({
      investment: i,
      goals: links
        .filter((l) => l.investmentId === i.id)
        .map((l) => goalNames.get(l.goalId) ?? ""),
    }))
    .filter((x) => x.goals.length > 0);

  return (
    <main className="space-y-4">
      <div className="space-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
            <GuideButton id="goals" />
          </div>
          {goals.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {formatINRCompact(saved)} saved
              {sips > 0 ? ` · ${formatINR(sips)} a month going in` : ""}
            </p>
          )}
        </div>
        {goals.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {updatable.length > 0 ? (
              <UpdateButton items={updatable} autoOpen={action === "update"} />
            ) : (
              <Link
                href="/goals/new"
                className={buttonVariants({ size: "sm", className: "w-full" })}
              >
                <Plus /> New goal
              </Link>
            )}
            <Link
              href="/import"
              className={buttonVariants({
                size: "sm",
                variant: "outline",
                className: "w-full",
              })}
            >
              <FileUp /> Import CAS
            </Link>
          </div>
        )}
      </div>

      {goals.length === 0 ? (
        <div className="space-y-3 rounded-2xl border bg-card p-6 text-center">
          <p className="text-lg font-semibold">What are you saving for?</p>
          <p className="text-sm text-muted-foreground">
            Add a goal, attach the investments saving for it, and see if
            you&apos;ll get there on time.
          </p>
          <Link href="/goals/new" className={buttonVariants()}>
            <Plus /> Add your first goal
          </Link>
          <p className="text-xs text-muted-foreground">
            Have mutual funds?{" "}
            <Link
              href="/import"
              className="text-primary underline underline-offset-2"
            >
              Import a CAS statement
            </Link>
          </p>
        </div>
      ) : (
        <>
          <GoalList
            suggestions={plan?.suggestions ?? []}
            goals={sortGoals(goals)}
            investments={investments}
            links={links}
            today={today}
            initialOpen={open ?? null}
          />
          <MoneyPlanCard
            plan={plan}
            sipsNow={sipsNow}
            unassigned={unassigned}
            autoOpen={action === "plan"}
          />
        </>
      )}
    </main>
  );
}
