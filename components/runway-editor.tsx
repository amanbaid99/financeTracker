"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { RunwayCard } from "@/components/runway-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatINR } from "@/lib/format";
import type { DueLine, Runway } from "@/lib/runway";
import { saveSalaryDates, setRunwayChoice } from "@/lib/runway-actions";
import { cn } from "@/lib/utils";

type Result = { ok: boolean; error?: string };

function useSave() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (
    fn: () => Promise<Result>,
    after?: () => void,
    note?: { text: string; undo?: () => Promise<Result> },
  ) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast({
          text: res.error ?? "Could not save. Try again.",
          tone: "danger",
        });
        return;
      }
      after?.();
      router.refresh();
      if (note)
        toast({
          text: note.text,
          tone: "success",
          action: note.undo
            ? {
                label: "Undo",
                onClick: async () => {
                  await note.undo!();
                  router.refresh();
                },
              }
            : undefined,
        });
    });
  return { pending, run };
}

function SalaryDates({
  best,
  worst,
  active,
}: {
  best: string | null;
  worst: string | null;
  active: boolean;
}) {
  const [b, setB] = useState(best ?? "");
  const [w, setW] = useState(worst ?? "");
  const { pending, run } = useSave();
  return (
    <section
      aria-labelledby="salary-h"
      className="surface-card space-y-3 rounded-2xl border border-border/70 bg-card p-4"
    >
      <div>
        <h2 id="salary-h" className="font-semibold">
          When does salary start?
        </h2>
        <p className="text-sm text-muted-foreground">
          Not sure? Give the earliest and the latest it could be. Until then,
          your savings goals are on hold, as planned.
        </p>
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveSalaryDates({ best: b, worst: w || b }), undefined, {
            text: "Salary dates saved.",
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
          <Field label="Earliest" htmlFor="sal-best">
            <Input
              id="sal-best"
              type="date"
              value={b}
              onChange={(e) => setB(e.target.value)}
              required
            />
          </Field>
          <Field label="Latest" htmlFor="sal-worst">
            <Input
              id="sal-worst"
              type="date"
              value={w}
              min={b || undefined}
              onChange={(e) => setW(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" className="w-full" disabled={pending || !b}>
          {pending ? "Saving…" : "Save dates"}
        </Button>
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={pending}
            onClick={() =>
              run(() => saveSalaryDates(null), undefined, {
                text: "Welcome back to salary. Your goals are active again.",
              })
            }
          >
            My salary has started
          </Button>
        )}
      </form>
    </section>
  );
}

const SOURCE: Record<DueLine["source"], string> = {
  emi: "EMI",
  living: "Living costs",
  bill: "From a bills fund",
  item: "Added by you",
};

/**
 * Covered till salary, kept light: your salary dates, the money you can
 * reach quickly, and what's due till then (EMIs from your loan goals, living
 * costs from your budget and bills-fund payments).
 */
export function RunwayEditor({
  runway,
  liquidHoldings,
  salaryBest,
  salaryWorst,
  active,
  monthlyLiving,
}: {
  runway: Runway | null;
  liquidHoldings: { name: string; value: number }[];
  salaryBest: string | null;
  salaryWorst: string | null;
  active: boolean;
  monthlyLiving: number;
}) {
  const { pending, run } = useSave();
  return (
    <div className="space-y-4">
      {runway && <RunwayCard view={{ runway }} link={false} />}
      <SalaryDates best={salaryBest} worst={salaryWorst} active={active} />

      {runway && (
        <>
          <section
            aria-labelledby="have-h"
            className="surface-card space-y-2 rounded-2xl border border-border/70 bg-card p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="have-h" className="font-semibold">
                Money you can reach quickly
              </h2>
              <span className="tabular font-semibold">
                {formatINR(runway.liquid)}
              </span>
            </div>
            <ul className="divide-y text-sm">
              {liquidHoldings.map((h) => (
                <li
                  key={h.name}
                  className="flex items-baseline justify-between gap-3 py-2"
                >
                  <span className="min-w-0 break-words">{h.name}</span>
                  <span className="tabular">{formatINR(h.value)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Savings accounts, FDs and liquid funds, including ones set aside
              for goals. Out of date?{" "}
              <Link href="/goals?do=update" className="text-primary underline">
                Update values
              </Link>
              .
            </p>
          </section>

          <section
            aria-labelledby="due-h"
            className="surface-card space-y-2 rounded-2xl border border-border/70 bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="due-h" className="font-semibold">
                  Due till {formatDate(runway.worst.until)}
                </h2>
                <p className="text-xs text-muted-foreground">
                  The latest salary date, so nothing is missed.
                </p>
              </div>
              <span className="tabular shrink-0 font-semibold">
                {formatINR(runway.worst.due)}
              </span>
            </div>
            <ul className="divide-y text-sm">
              {runway.worst.lines.map((l) => {
                const late =
                  l.source !== "living" && l.date > runway.best.until;
                return (
                  <li key={l.key} className="space-y-1 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block break-words font-medium",
                            !l.counted && "text-muted-foreground line-through",
                          )}
                        >
                          {l.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {l.source === "living"
                            ? `${formatINR(monthlyLiving)} a month till ${formatDate(l.date)}`
                            : `${SOURCE[l.source]} · ${formatDate(l.date)}`}
                          {late && " · only if salary is late"}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "tabular shrink-0",
                          !l.counted && "text-muted-foreground line-through",
                        )}
                      >
                        {formatINR(l.amount)}
                      </span>
                    </div>
                    {l.why && (
                      <p className="text-xs text-muted-foreground">
                        {l.counted
                          ? "Counted."
                          : `Not counted: ${l.why.toLowerCase()}.`}
                      </p>
                    )}
                    {(l.source === "bill" || l.source === "living") && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-10"
                        disabled={pending}
                        onClick={() =>
                          run(() => setRunwayChoice(l.key, !l.counted))
                        }
                      >
                        {l.counted ? "Don't count this" : "Count this"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">
              EMIs come from your loan goals, living costs from your budget.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
