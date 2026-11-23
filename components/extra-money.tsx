"use client";
import {hybridMoneyPlan} from "@/lib/hybrid-plan";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { useQuickAction } from "@/components/quick-add";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/field";
import { type MoneyPlan } from "@/lib/allocate";
import { clearParam } from "@/lib/clear-param";
import { formatINR } from "@/lib/format";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";

/**
 * "I have extra money": where a one-time amount would go, worked out by the
 * same plan. Nothing is saved until you add it to your plan.
 */
export function ExtraMoney({
  goals,
  investments,
  links,
  today,
  autoOpen = false,
}: {
  goals: TrackedGoal[];
  investments: Investment[];
  links: Link[];
  today: string;
  plan: MoneyPlan | null;
  sipsNow: number;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [amount, setAmount] = useState<number | null>(null);
  useQuickAction(
    "extra",
    useCallback(() => setOpen(true), []),
  );
  const close = () => {
    setOpen(false);
    setAmount(null);
    clearParam("do");
  };
  if (!open) return null;
  const split =
    amount && Number.isSafeInteger(amount) && amount > 0 && amount<=1e13
      ? hybridMoneyPlan({
          goals,
          investments,
          links,
          oneTime:amount,
          monthlySavings:0,
          today,
        })
      : null;
  const parts = split?.suggestions.filter((s) => s.lump > 0) ?? [];
  return (
    <Sheet title="Put extra money to work" onClose={close}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Preview a bonus or gift as separate one-time money. This does not count as monthly income. Record received money in Net worth before reviewing your plan.
        </p>
        <Field label="How much?" htmlFor="extra-amount">
          <MoneyInput
            id="extra-amount"
            value={amount}
            onChange={setAmount}
            placeholder="e.g. 50,000"
          />
        </Field>
        {split && (
          <div className="space-y-2">
            {parts.length > 0 ? (
              <ul
                className="divide-y rounded-xl border"
                aria-label="Where it goes"
              >
                {parts.map((s) => (
                  <li key={s.goalId} className="space-y-0.5 p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium">
                        {s.goalName}
                      </span>
                      <span className="tabular shrink-0 text-sm font-semibold">
                        {formatINR(s.lump)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.categoryLabel}: {s.why}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {goals.length?"Your goals do not need a one-time amount right now.":"Add a goal first so we can suggest where this money helps."}
              </p>
            )}
            {split.leftoverLump > 0 && parts.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatINR(split.leftoverLump)} isn&apos;t needed by any goal
                yet. Keep it aside or start a new goal.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Essentials come first in this one-time preview. Nothing is saved or invested. Not investment advice.
            </p>
          </div>
        )}
        <Button
          type="button"
          className="w-full"
          disabled={parts.length===0}
          onClick={()=>{close();router.push("/assets?do=update");}}
        >
          Record received money
        </Button>
      </div>
    </Sheet>
  );
}
