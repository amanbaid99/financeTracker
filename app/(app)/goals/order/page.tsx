import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { OrderEditor, type OrderGoal } from "@/components/order-editor";
import { loadGoals } from "@/lib/data";
import { goalSubline, horizonGroup, horizonRank } from "@/lib/goal-status";
import type { TrackedGoal } from "@/lib/tracker";

export const metadata: Metadata = { title: "Your order" };

export default async function OrderPage() {
  const { goals, today } = await loadGoals();
  const active = goals.filter(
    (g) => g.status !== "reached" && !(g.loanState && g.emisCloseFirst),
  );
  const view = (g: TrackedGoal): OrderGoal => ({
    id: g.id,
    name: g.name,
    type: g.type,
    sub: goalSubline(g),
  });
  const pinned = active.filter((g) => g.billsFund);
  const rest = active.filter((g) => !g.billsFund);
  const custom = rest.some((g) => g.planRank != null);
  // Your saved order, or the app's: emergency fund first, then by when
  // each goal is due.
  const sorted = [...rest].sort((a, b) =>
    custom
      ? (a.planRank ?? 999) - (b.planRank ?? 999)
      : Number(b.type === "emergency_fund") -
          Number(a.type === "emergency_fund") ||
        horizonRank(horizonGroup(a, today)) -
          horizonRank(horizonGroup(b, today)) ||
        (a.months ?? 999) - (b.months ?? 999),
  );
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
