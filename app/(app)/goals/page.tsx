import { FileUp, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CasGuideButton } from "@/components/cas-guide";
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
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;
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
    <main className="space-y-5">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your goals</h1>
          {goals.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {formatINRCompact(saved)} saved
              {sips > 0 ? ` · ${formatINR(sips)} a month going in` : ""}
            </p>
          )}
        </div>
        <div
          className={updatable.length > 0 ? "grid grid-cols-2 gap-2" : "flex"}
        >
          {updatable.length > 0 && <UpdateButton items={updatable} />}
          <Link
            href="/goals/new"
            className={buttonVariants({ className: "w-full" })}
          >
            <Plus /> New goal
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href="/import"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            <FileUp className="size-4" aria-hidden /> Import a CAS statement
          </Link>
          <CasGuideButton label="How to get it" />
        </div>
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
        </div>
      ) : (
        <>
          <MoneyPlanCard
            plan={plan}
            sipsNow={sipsNow}
            unassigned={unassigned}
          />
          <GoalList
            suggestions={plan?.suggestions ?? []}
            goals={sortGoals(goals)}
            investments={investments}
            links={links}
            today={today}
            initialOpen={open ?? null}
          />
        </>
      )}
    </main>
  );
}
