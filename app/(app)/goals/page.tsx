import { Plus } from "lucide-react";
import { GuideButton } from "@/components/guides";
import type { Metadata } from "next";
import Link from "next/link";
import { GoalsOverview } from "@/components/goals-overview";
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
  // Every investment remains updatable from the + menu.
  const goalNames = new Map(goals.map((g) => [g.id, g.name]));
  const updatable = investments
    .map((i) => ({
      investment: i,
      goals: links
        .filter((l) => l.investmentId === i.id)
        .map((l) => goalNames.get(l.goalId) ?? ""),
    }));

  return (
    <main className="space-y-5">
      <div className="space-y-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
            <GuideButton id="goals" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Make room for what matters to you.</p>
          {goals.length > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-4 border-y border-border/60 py-3">
              <div><dt className="text-xs text-muted-foreground">Saved toward goals</dt><dd className="tabular mt-1 text-2xl font-semibold tracking-tight">{formatINRCompact(saved)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Going in each month</dt><dd className="tabular mt-1 text-2xl font-semibold tracking-tight">{formatINR(sips)}</dd></div>
            </dl>
          )}
        </div>

      </div>

      {updatable.length > 0 && <UpdateButton items={updatable} autoOpen={action === "update"} showButton={false} />}

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
          <GoalsOverview
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
          />
        </>
      )}
    </main>
  );
}
