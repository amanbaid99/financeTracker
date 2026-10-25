import { ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { loadAnalysis } from "@/lib/data";
import { categoryLabel } from "@/lib/engine/categories";
import type { HoldingKind } from "@/lib/engine/types";
import { formatINR, formatINRCompact } from "@/lib/format";
import { HOLDING_KIND_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Holdings" };

const GROUPS: { title: string; kinds: HoldingKind[] }[] = [
  { title: "Bank & cash", kinds: ["savings"] },
  { title: "Fixed deposits", kinds: ["fd"] },
  { title: "Mutual funds", kinds: ["mutual_fund"] },
  { title: "Stocks", kinds: ["stock"] },
  { title: "PPF, EPF & NPS", kinds: ["ppf", "epf", "nps"] },
  { title: "Gold & other", kinds: ["gold", "other"] },
];

export default async function HoldingsPage() {
  const { raw, data } = await loadAnalysis();
  const goalName = new Map(raw.goals.map((g) => [g.id, g.name]));
  const total = data.holdings.reduce((s, h) => s + h.currentValue, 0);
  const sips = data.holdings.reduce((s, h) => s + (h.monthlySip ?? 0), 0);

  const rows = data.holdings.map((h) => {
    const allocs = data.allocations.filter((a) => a.holdingId === h.id);
    const pct = allocs.reduce((s, a) => s + a.percent, 0);
    return {
      h,
      goals: allocs.map((a) => (allocs.length > 1 ? `${goalName.get(a.goalId)} ${a.percent}%` : goalName.get(a.goalId))),
      unassigned: (h.currentValue * Math.max(0, 100 - pct)) / 100,
    };
  });
  const unassigned = rows.reduce((s, r) => s + r.unassigned, 0);
  const groups = GROUPS.map((g) => {
    const items = rows.filter((r) => g.kinds.includes(r.h.kind)).sort((a, b) => b.h.currentValue - a.h.currentValue);
    return { ...g, items, total: items.reduce((s, r) => s + r.h.currentValue, 0) };
  }).filter((g) => g.items.length);

  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Holdings</h1>
          <p className="text-sm text-muted-foreground">Everything you own, and what each part is for.</p>
        </div>
        <Link href="/holdings/new" className={buttonVariants()}>
          <Plus /> Add
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 pt-5 text-sm sm:pt-5">
            <p className="font-medium">Nothing added yet</p>
            <p className="text-muted-foreground">
              Start with your bank balance, then add FDs, mutual funds, PPF or anything else you hold.
            </p>
            <Link href="/holdings/new" className={buttonVariants({ variant: "outline" })}>
              <Plus /> Add your first holding
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-4 pt-5 sm:pt-5">
              <dl className="grid grid-cols-3 gap-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Total</dt>
                  <dd className="tabular text-lg font-semibold sm:text-xl">{formatINRCompact(total)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">SIPs a month</dt>
                  <dd className="tabular text-lg font-semibold sm:text-xl">{formatINRCompact(sips)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                    Not for a goal
                    <InfoTip text="Money not linked to any goal yet. Link it so your plan knows what it's for." />
                  </dt>
                  <dd className="tabular text-lg font-semibold sm:text-xl">{formatINRCompact(unassigned)}</dd>
                </div>
              </dl>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Where your money is</p>
                {groups.map((g) => {
                  const share = total > 0 ? (g.total / total) * 100 : 0;
                  return (
                    <div key={g.title} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-sm">
                      <span className="truncate">{g.title}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                      </span>
                      <span className="tabular w-10 text-right text-xs text-muted-foreground">
                        {Math.round(share)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {groups.map((g) => (
            <section key={g.title} className="space-y-2" aria-labelledby={`grp-${g.title}`}>
              <div className="flex items-baseline justify-between px-1">
                <h2 id={`grp-${g.title}`} className="text-sm font-semibold">
                  {g.title}
                </h2>
                <span className="tabular text-sm text-muted-foreground">{formatINR(g.total)}</span>
              </div>
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {g.items.map(({ h, goals }) => (
                  <li key={h.id}>
                    <Link href={`/holdings/${h.id}`} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium">{h.name || HOLDING_KIND_LABELS[h.kind]}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {categoryLabel(h.category)}
                          {h.monthlySip ? ` · SIP ${formatINR(h.monthlySip)}/mo` : ""}
                          {h.monthlySip && h.sipStepUpPct ? ` +${h.sipStepUpPct}%/yr` : ""}
                        </p>
                        {goals.length ? (
                          <p className="flex flex-wrap gap-1">
                            {goals.map((name) => (
                              <span key={name} className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] text-primary">
                                {name}
                              </span>
                            ))}
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">Not linked to a goal</p>
                        )}
                      </div>
                      <span className="tabular shrink-0 text-sm font-medium">{formatINR(h.currentValue)}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-center text-xs text-muted-foreground">
            Updating values?{" "}
            <Link href="/update" className="text-primary underline">
              Quick update
            </Link>{" "}
            changes them all on one screen.
          </p>
        </>
      )}
    </main>
  );
}
