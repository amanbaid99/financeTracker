import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { OrderEditor, type OrderGoal } from "@/components/order-editor";
import { loadGoals } from "@/lib/data";
import { goalSubline } from "@/lib/goal-status";
import type { TrackedGoal } from "@/lib/tracker";

export const metadata: Metadata = { title: "Your order" };

export default async function OrderPage() {
  const { goals } = await loadGoals();
  // Every goal not reached yet, loans the EMIs close included, so you can
  // place them too.
  const active = goals.filter((g) => g.status !== "reached"&&!g.completed&&(g.goalCategory??(["emergency_fund","bills_fund","loan_payoff"].includes(g.type)?"essential":"flexible"))==="essential");
  const view = (g: TrackedGoal): OrderGoal => ({
    id: g.id,
    name: g.name,
    type: g.type,
    sub: goalSubline(g),
  });
  const custom=active.some(g=>g.planRank!=null);
  const sorted=[...active].sort((a,b)=>(a.planRank??999)-(b.planRank??999)||(a.targetDate??"9999").localeCompare(b.targetDate??"9999")||a.id.localeCompare(b.id));
  return (
    <main className="space-y-4">
      <BackLink fallback="/goals/plan" label="Your plan" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Essential goal order</h1>
        <p className="text-sm text-muted-foreground">
          Essentials are funded in this order, starting with their minimums. Flexible goals share what remains by priority, deadline and need. Undated goals need an explicit monthly amount; emergency funds use a visible build assumption.
        </p>
      </div>
      <OrderEditor
        essentialOnly
        pinned={[]}
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
