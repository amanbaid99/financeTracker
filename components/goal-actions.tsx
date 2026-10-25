"use client";

import { ChevronRight, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { GoalForm } from "@/components/goal-form";
import { InvestmentSheet, investmentSub, investmentTitle } from "@/components/investment-sheet";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { deleteGoal } from "@/lib/actions";
import { formatINR } from "@/lib/format";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";

export function EditGoalButton({ goal, today }: { goal: TrackedGoal; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil /> Edit
      </Button>
      {open && (
        <Sheet title="Edit goal" onClose={close}>
          <GoalForm
            goal={goal}
            today={today}
            onSaved={() => {
              router.refresh();
              close();
            }}
          />
        </Sheet>
      )}
    </>
  );
}

export function InvestmentRow({
  investment,
  value,
  sip,
  percent,
  onClick,
}: {
  investment: Investment;
  value: number;
  sip: number;
  percent: number;
  onClick: () => void;
}) {
  const title = investmentTitle(investment);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Edit ${title}`}
        className="flex w-full items-center gap-3 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {investmentSub(investment)}
            {sip > 0 ? ` · ${formatINR(sip)}/mo` : ""}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="tabular block text-sm">{formatINR(value)}</span>
          {percent < 100 && <span className="block text-xs text-muted-foreground">{percent}% of it</span>}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

type Open = { investment: Investment | null; percent: number | null } | null;

export function GoalInvestments({
  goal,
  investments,
  links,
}: {
  goal: TrackedGoal;
  investments: Investment[];
  links: Link[];
}) {
  const [open, setOpen] = useState<Open>(null);
  const close = useCallback(() => setOpen(null), []);
  return (
    <section className="space-y-2" aria-labelledby="inv-h">
      <h2 id="inv-h" className="text-sm font-semibold">
        Saving for it in
      </h2>
      {goal.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing yet. Add the mutual funds, stocks or deposits you&apos;re putting toward this goal.
        </p>
      ) : (
        <ul className="divide-y">
          {goal.lines.map((l) => (
            <InvestmentRow
              key={l.investment.id}
              investment={l.investment}
              value={l.value}
              sip={l.monthlySip}
              percent={l.percent}
              onClick={() => setOpen({ investment: l.investment, percent: l.percent })}
            />
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" className="w-full" onClick={() => setOpen({ investment: null, percent: null })}>
        <Plus /> Add investment
      </Button>
      {open && (
        <InvestmentSheet
          goalId={goal.id}
          goalName={goal.name}
          linkedIds={goal.lines.map((l) => l.investment.id)}
          investment={open.investment}
          percent={open.percent}
          investments={investments}
          links={links}
          onClose={close}
        />
      )}
    </section>
  );
}

export function UnlinkedInvestments({ investments, links }: { investments: Investment[]; links: Link[] }) {
  const [open, setOpen] = useState<Investment | null>(null);
  const close = useCallback(() => setOpen(null), []);
  return (
    <details className="rounded-xl border bg-card">
      <summary className="cursor-pointer list-none p-4 text-sm">
        {investments.length} investment{investments.length === 1 ? "" : "s"} not linked to a goal
      </summary>
      <ul className="divide-y border-t px-4">
        {investments.map((i) => (
          <InvestmentRow key={i.id} investment={i} value={i.value} sip={i.monthlySip} percent={100} onClick={() => setOpen(i)} />
        ))}
      </ul>
      <p className="px-4 pb-3 text-xs text-muted-foreground">
        Open a goal and choose &ldquo;Add investment&rdquo;, then &ldquo;One I already have&rdquo; to link one.
      </p>
      {open && (
        <InvestmentSheet
          goalId={null}
          linkedIds={[]}
          investment={open}
          percent={null}
          investments={investments}
          links={links}
          onClose={close}
        />
      )}
    </details>
  );
}

export function DeleteGoalButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1 text-center">
      <Button
        type="button"
        variant={confirm ? "destructive" : "ghost"}
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm) return setConfirm(true);
          start(async () => {
            const res = await deleteGoal(id);
            if (res.ok) router.push("/goals");
          });
        }}
      >
        {confirm ? "Tap again to delete this goal" : "Delete goal"}
      </Button>
      {confirm && <p className="text-xs text-muted-foreground">Its investments stay; they&apos;re just unlinked.</p>}
    </div>
  );
}
