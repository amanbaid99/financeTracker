"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { MoneyInput } from "@/components/money-input";
import { useQuickAction } from "@/components/quick-add";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/field";
import { savePlan } from "@/lib/actions";
import { planMoney, type MoneyPlan } from "@/lib/allocate";
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
  plan,
  sipsNow,
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
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
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
    amount && amount > 0
      ? planMoney({
          goals,
          investments,
          links,
          lump: amount,
          monthlyTotal: sipsNow,
          todayISO: today,
        })
      : null;
  const parts = split?.suggestions.filter((s) => s.lump > 0) ?? [];
  return (
    <Sheet title="Put extra money to work" onClose={close}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          A bonus, a gift or savings sitting idle. See where it helps most.
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
                Your goals don&apos;t need a one-time amount right now.
              </p>
            )}
            {split.leftoverLump > 0 && parts.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatINR(split.leftoverLump)} isn&apos;t needed by any goal
                yet. Keep it aside or start a new goal.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Bills and your emergency cushion come first, then the nearest
              goals. Not investment advice.
            </p>
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft p-2 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <Button
          type="button"
          className="w-full"
          disabled={pending || parts.length === 0}
          onClick={() =>
            start(async () => {
              setError("");
              const res = await savePlan({
                lump: (plan?.lump ?? 0) + (amount ?? 0),
                monthly: plan?.monthlyTotal ?? sipsNow,
              });
              if (!res.ok) return setError(res.error);
              close();
              router.push("/goals/plan");
              router.refresh();
            })
          }
        >
          {pending ? "Adding…" : "Add to my plan"}
        </Button>
      </div>
    </Sheet>
  );
}
