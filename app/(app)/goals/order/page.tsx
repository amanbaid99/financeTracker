import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { OrderEditor, type OrderGoal } from "@/components/order-editor";
import { loadGoals } from "@/lib/data";
import { goalSubline } from "@/lib/goal-status";
import { planOrder } from "@/lib/goal-order";
import type { TrackedGoal } from "@/lib/tracker";

export const metadata: Metadata = { title: "Your order" };

export default async function OrderPage() {
  const { goals, today } = await loadGoals();
  // Every goal not reached yet, loans the EMIs close included, so you can
  // place them too.
  const active = goals.filter((g) => g.status !== "reached");
  const view = (g: TrackedGoal): OrderGoal => ({
    id: g.id,
    name: g.name,
    type: g.type,
    sub: goalSubline(g),
  });
  const pinned = active.filter((g) => g.billsFund);
  const rest = active.filter((g) => !g.billsFund);
  const custom = rest.some((g) => g.planRank != null);
  // Your saved order, or the app's (see lib/goal-order.ts).
  const sorted = planOrder(rest, today);
  return (
    <main className="space-y-4">
      <BackLink fallback="/goals/plan" label="Your plan" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your order</h1>
        <p className="text-sm text-muted-foreground">
          Put the goals that matter most at the top. The plan gives each one
          what it needs to be on time before moving to the next. A goal without
          a date is built over two years.
        </p>
      </div>
      <OrderEditor
        pinned={pinned.map(view)}
        goals={sorted.map(view)}
        custom={custom}
      />
      <p className="text-xs text-muted-foreground">
        {custom
          ? "You're using your own order."
          : "This is the app's order. Change anything and save to make it yours."}{" "}
        Nothing changes in your investments until you set up a step from your
        plan.
      </p>
    </main>
  );
}
