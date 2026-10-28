"use client";

import { ChevronRight, Pencil, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { GoalForm } from "@/components/goal-form";
import {
  InvestmentSheet,
  investmentSub,
  investmentTitle,
} from "@/components/investment-sheet";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { deleteGoal } from "@/lib/actions";
import type { Suggestion } from "@/lib/allocate";
import { goalHeadline } from "@/lib/goal-summary";
import { waysToFund, type WaysToFund } from "@/lib/fund-goal";
import { pickFund } from "@/lib/sip-plan";
import { formatINR } from "@/lib/format";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";

export function EditGoalButton({
  goal,
  today,
}: {
  goal: TrackedGoal;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
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
          {percent < 100 && (
            <span className="block text-xs text-muted-foreground">
              {percent}% of it
            </span>
          )}
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </button>
    </li>
  );
}

type Open = {
  investment: Investment | null;
  percent: number | null;
  /** Start on "One I already have" with this one picked. */
  pick?: string;
  /** Start a new one filled in from a suggestion. */
  prefill?: { fundCategory: string; value: number; monthlySip: number };
} | null;

/** For a goal with nothing linked: existing investments that fit, or a new one. */
function FundSuggestions({
  ways,
  showFresh,
  onLink,
  onNew,
}: {
  ways: WaysToFund;
  showFresh: boolean;
  onLink: (investmentId: string) => void;
  onNew: () => void;
}) {
  const f = ways.fresh;
  return (
    <div className="space-y-3 rounded-lg bg-primary-soft p-3 text-sm">
      <p className="flex items-center gap-1.5 font-semibold text-primary">
        <Sparkles className="size-4" aria-hidden /> How to save for it
      </p>
      {ways.existing.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            From what you already have
          </p>
          <ul className="divide-y divide-primary/15">
            {ways.existing.map((o) => (
              <li
                key={o.investment.id}
                className="flex items-center gap-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {investmentTitle(o.investment)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatINR(o.freeValue)}
                    {o.freePercent < 100
                      ? ` free (${o.freePercent}%)`
                      : ""} · {o.why}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`Link ${investmentTitle(o.investment)}`}
                  onClick={() => onLink(o.investment.id)}
                >
                  Link
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {showFresh && f && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {ways.existing.length > 0
              ? "Or start something new"
              : "Start something new"}
          </p>
          <p>
            {f.monthly > 0 ? (
              <>
                A <b>{formatINR(f.monthly)} a month</b> SIP in{" "}
              </>
            ) : (
              "Put money in "
            )}
            {/^[aeiou]/i.test(f.categoryLabel) ? "an" : "a"}{" "}
            {f.categoryLabel.toLowerCase()} ({f.why}).
          </p>
          <Button type="button" size="sm" onClick={onNew}>
            <Plus /> Add it
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Suggestions only. Nothing is linked or added until you save.
      </p>
    </div>
  );
}

export function GoalInvestments({
  goal,
  investments,
  links,
  hasPlanSuggestion = false,
}: {
  goal: TrackedGoal;
  investments: Investment[];
  links: Link[];
  /** The money plan already suggests a new investment for this goal. */
  hasPlanSuggestion?: boolean;
}) {
  const [open, setOpen] = useState<Open>(null);
  const ways =
    goal.lines.length === 0 ? waysToFund(goal, investments, links) : null;
  const close = useCallback(() => setOpen(null), []);
  return (
    <section className="space-y-2" aria-labelledby="inv-h">
      <h2 id="inv-h" className="text-sm font-semibold">
        Saving for it in
      </h2>
      {goal.lines.length === 0 ? (
        ways &&
        (ways.existing.length > 0 || (ways.fresh && !hasPlanSuggestion)) ? (
          <FundSuggestions
            ways={ways}
            showFresh={!hasPlanSuggestion}
            onLink={(id) =>
              setOpen({ investment: null, percent: null, pick: id })
            }
            onNew={() =>
              setOpen({
                investment: null,
                percent: null,
                prefill: ways.fresh
                  ? {
                      fundCategory: ways.fresh.category,
                      value: 0,
                      monthlySip: ways.fresh.monthly,
                    }
                  : undefined,
              })
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Add the mutual funds, stocks or deposits you&apos;re
            putting toward this goal.
          </p>
        )
      ) : (
        <ul className="divide-y">
          {goal.lines.map((l) => (
            <InvestmentRow
              key={l.investment.id}
              investment={l.investment}
              value={l.value}
              sip={l.monthlySip}
              percent={l.percent}
              onClick={() =>
                setOpen({ investment: l.investment, percent: l.percent })
              }
            />
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setOpen({ investment: null, percent: null })}
      >
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
          pickExisting={open.pick}
          prefill={open.prefill}
          fromPlan={false}
        />
      )}
    </section>
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
            if (res.ok) {
              router.replace("/goals");
              router.refresh();
            }
          });
        }}
      >
        {confirm ? "Tap again to delete this goal" : "Delete goal"}
      </Button>
      {confirm && (
        <p className="text-xs text-muted-foreground">
          Its investments stay; they&apos;re just unlinked.
        </p>
      )}
    </div>
  );
}

/** The plan's suggestion for one goal, with a button to record it once invested. */
export function SuggestionBox({
  goal,
  suggestion: s,
  investments,
  links,
}: {
  goal: TrackedGoal;
  suggestion: Suggestion;
  investments: Investment[];
  links: Link[];
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  // One of your own funds that suits it, if you have one.
  const pick = pickFund(goal.id, s.category, investments, links);
  const what = [
    s.lump ? `${formatINR(s.lump)} now` : "",
    s.monthly ? `${formatINR(s.monthly)} a month` : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const kind = `${/^[aeiou]/i.test(s.categoryLabel) ? "an" : "a"} ${s.categoryLabel.toLowerCase()}`;
  const linkPct = pick
    ? (links.find(
        (l) => l.goalId === goal.id && l.investmentId === pick.investment.id,
      )?.percent ?? null)
    : null;
  return (
    <div className="space-y-2 rounded-lg bg-primary-soft p-3 text-sm">
      <p className="flex items-center gap-1.5 font-semibold text-primary">
        <Sparkles className="size-4" aria-hidden /> Suggested
      </p>
      {pick ? (
        <p>
          Put <b>{what}</b> into your <b>{investmentTitle(pick.investment)}</b>
          {pick.similar
            ? ` (close enough to ${kind}, ${s.why})`
            : ` (${s.why})`}
          .
        </p>
      ) : (
        <p>
          Put <b>{what}</b> into {kind} ({s.why}).
        </p>
      )}
      <p className="text-muted-foreground">
        With this: {goalHeadline(s.after).text}.
      </p>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        I&apos;ve invested this
      </Button>
      {open &&
        (pick ? (
          <InvestmentSheet
            goalId={goal.id}
            goalName={goal.name}
            linkedIds={goal.lines.map((l) => l.investment.id)}
            investment={pick.investment}
            percent={linkPct}
            investments={investments}
            links={links}
            onClose={close}
            topUp={{ value: s.lump, sip: s.monthly }}
          />
        ) : (
          <InvestmentSheet
            goalId={goal.id}
            goalName={goal.name}
            linkedIds={goal.lines.map((l) => l.investment.id)}
            investment={null}
            percent={null}
            investments={investments}
            links={links}
            onClose={close}
            prefill={{
              fundCategory: s.category,
              value: s.lump,
              monthlySip: s.monthly,
            }}
          />
        ))}
    </div>
  );
}
