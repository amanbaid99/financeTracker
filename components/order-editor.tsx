"use client";

import { ArrowDown, ArrowUp, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GoalIcon } from "@/components/goal-icon";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { savePlanOrder } from "@/lib/order-actions";

export interface OrderGoal {
  id: string;
  name: string;
  type: string;
  sub: string;
}

/** Move goals up and down; the plan funds them top first. */
export function OrderEditor({
  pinned,
  goals,
  custom,
}: {
  /** Bills funds: always first. */
  pinned: OrderGoal[];
  goals: OrderGoal[];
  /** Whether you've set your own order already. */
  custom: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [order, setOrder] = useState(goals);
  const [pending, start] = useTransition();
  const changed = !custom || order.some((g, i) => g.id !== goals[i]?.id);
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  const save = (ids: string[] | null, text: string) =>
    start(async () => {
      const res = await savePlanOrder(ids);
      if (!res.ok) {
        toast({ text: res.error, tone: "danger" });
        return;
      }
      toast({ text, tone: "success" });
      router.refresh();
    });

  const row = (g: OrderGoal, n: number, controls?: React.ReactNode) => (
    <li key={g.id} className="flex items-center gap-3 py-2.5">
      <span
        className="tabular inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
        aria-hidden
      >
        {n}
      </span>
      <GoalIcon type={g.type} className="size-8" />
      <span className="min-w-0 flex-1">
        <span className="block break-words font-medium">{g.name}</span>
        {g.sub && (
          <span className="block text-xs text-muted-foreground">{g.sub}</span>
        )}
      </span>
      {controls}
    </li>
  );

  return (
    <div className="space-y-4">
      <section className="surface-card rounded-2xl border border-border/70 bg-card p-4">
        <ol className="divide-y" aria-label="Your order" data-guide="order">
          {pinned.map((g, i) =>
            row(
              g,
              i + 1,
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="size-3.5" aria-hidden /> Always first
              </span>,
            ),
          )}
          {order.map((g, i) =>
            row(
              g,
              pinned.length + i + 1,
              <span className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-11"
                  aria-label={`Move ${g.name} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-11"
                  aria-label={`Move ${g.name} down`}
                  disabled={i === order.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown />
                </Button>
              </span>,
            ),
          )}
        </ol>
        {pinned.length > 0 && (
          <p className="border-t pt-2 text-xs text-muted-foreground">
            Bills funds stay first: a missed payment costs more than a goal that
            waits a little.
          </p>
        )}
      </section>
      <Button
        type="button"
        className="w-full"
        disabled={pending || !changed}
        onClick={() =>
          save(
            order.map((g) => g.id),
            "Your order is saved. The plan follows it now.",
          )
        }
      >
        {pending ? "Saving…" : "Save this order"}
      </Button>
      {custom && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          disabled={pending}
          onClick={() => save(null, "Back to the app's order.")}
        >
          Use the app&apos;s order instead
        </Button>
      )}
    </div>
  );
}
