"use client";

import { ArrowUpRight, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { rateNote, type Budget } from "@/lib/budget";
import { applyBudgetToPlan } from "@/lib/budget-actions";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

const PARTS = [
  { key: "costs", label: "costs", color: "bg-foreground/35" },
  { key: "emis", label: "EMIs", color: "bg-warning" },
  { key: "sips", label: "SIPs", color: "bg-primary" },
  { key: "free", label: "free", color: "bg-primary/30" },
] as const;

/** Money in, money out and what's free to invest, as one bar and one number. */
export function BudgetSummary({ b }: { b: Budget }) {
  const total = Math.max(b.income, b.costs + b.emis + b.sips);
  const value = {
    costs: b.costs,
    emis: b.emis,
    sips: b.sips,
    free: Math.max(0, b.free),
  };
  const note = rateNote(b.rateWithPlan);
  return (
    <div className="space-y-2">
      <p className="tabular">
        {b.free >= 0 ? (
          <>
            <span className="text-2xl font-semibold tracking-tight">
              {formatINR(b.free)}
            </span>{" "}
            <span className="text-sm text-muted-foreground">
              free to invest a month
            </span>
          </>
        ) : (
          <>
            <span className="text-2xl font-semibold tracking-tight text-danger">
              {formatINR(-b.free)}
            </span>{" "}
            <span className="text-sm text-danger">
              a month more going out than coming in
            </span>
          </>
        )}
      </p>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Of ${formatINR(b.income)} coming in: ${PARTS.map((p) => `${formatINR(value[p.key])} ${p.label}`).join(", ")}`}
      >
        {PARTS.map((p) =>
          value[p.key] > 0 ? (
            <span
              key={p.key}
              className={p.color}
              style={{ width: `${(value[p.key] / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <p className="tabular flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{formatINR(b.income)} in</span>
        {PARTS.filter((p) => p.key !== "free").map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1">
            <span className={cn("size-2 rounded-full", p.color)} aria-hidden />
            {formatINR(value[p.key])} {p.label}
          </span>
        ))}
      </p>
      {b.income > 0 && (
        <p
          className={cn(
            "text-xs",
            note.tone === "low" ? "text-warning" : "text-muted-foreground",
          )}
        >
          Investing {Math.round(b.rateNow * 100)}% of take-home now
          {b.free > 0
            ? `, ${Math.round(b.rateWithPlan * 100)}% if the free amount goes in too`
            : ""}
          . {note.text}
        </p>
      )}
    </div>
  );
}

/** "Use it for This month": sets the money plan's monthly budget. */
export function UseForPlan({
  b,
  planMonthly,
}: {
  b: Budget;
  planMonthly: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  if (b.free <= 0 || planMonthly === b.planMonthly) return null;
  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("");
            const res = await applyBudgetToPlan();
            if (!res.ok) return setError(res.error);
            router.refresh();
          })
        }
      >
        {pending
          ? "Saving…"
          : `Use ${formatINR(b.planMonthly)} a month for This month`}
      </Button>
      <p className="text-xs text-muted-foreground">
        Your SIPs plus what&apos;s free. This month then splits it across your
        goals.
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/** The budget at the top of Goals. */
export function BudgetCard({
  b,
  planMonthly,
}: {
  b: Budget;
  planMonthly: number | null;
}) {
  if (b.income <= 0)
    return (
      <Link
        href="/goals/budget"
        className="press flex min-h-16 items-center gap-3 rounded-2xl border bg-card px-4 py-3 hover:border-primary"
      >
        <Wallet className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Set up your budget</span>
          <span className="block text-xs text-muted-foreground">
            Add your take-home pay to see what&apos;s free to invest each month.
          </span>
        </span>
        <ArrowUpRight className="size-4 shrink-0 text-primary" aria-hidden />
      </Link>
    );
  return (
    <section
      aria-labelledby="month-h"
      className="space-y-3 rounded-2xl border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="month-h" className="flex items-center gap-1.5 font-semibold">
          <Wallet className="size-4 text-primary" aria-hidden /> Your month
        </h2>
        <Link href="/goals/budget" className="text-sm text-primary">
          Edit budget
        </Link>
      </div>
      <BudgetSummary b={b} />
      <UseForPlan b={b} planMonthly={planMonthly} />
    </section>
  );
}
