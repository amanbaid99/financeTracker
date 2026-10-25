import { ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { UnlinkedInvestments } from "@/components/goal-actions";
import { GoalIcon } from "@/components/goal-icon";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { loadGoals } from "@/lib/data";
import { formatINR, formatINRCompact } from "@/lib/format";
import { goalHeadline, TONE_BAR, TONE_TEXT } from "@/lib/goal-summary";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const { goals, investments, links } = await loadGoals();
  const linked = new Set(links.map((l) => l.investmentId));
  const unlinked = investments.filter((i) => !linked.has(i.id));
  const saved = goals.reduce((s, g) => s + g.current, 0);
  const sips = goals.reduce((s, g) => s + g.monthlySip, 0);

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your goals</h1>
          {goals.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {formatINRCompact(saved)} saved{sips > 0 ? ` · ${formatINR(sips)} a month going in` : ""}
            </p>
          )}
        </div>
        <Link href="/goals/new" className={buttonVariants()}>
          <Plus /> New goal
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="space-y-3 rounded-2xl border bg-card p-6 text-center">
          <p className="text-lg font-semibold">What are you saving for?</p>
          <p className="text-sm text-muted-foreground">
            Add a goal, attach the investments saving for it, and see if you&apos;ll get there on time.
          </p>
          <Link href="/goals/new" className={buttonVariants()}>
            <Plus /> Add your first goal
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const h = goalHeadline(g);
            return (
              <li key={g.id}>
                <Link
                  href={`/goals/${g.id}`}
                  className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary"
                >
                  <GoalIcon type={g.type} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{g.name}</span>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">
                        {formatINRCompact(g.current)} / {formatINRCompact(g.futureTarget || g.target)}
                      </span>
                    </div>
                    <Progress value={g.progress * 100} tone={TONE_BAR[h.tone]} label={`${g.name} progress`} />
                    <p className={cn("truncate text-xs font-medium", TONE_TEXT[h.tone])}>{h.text}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {unlinked.length > 0 && <UnlinkedInvestments investments={unlinked} links={links} />}
    </main>
  );
}
