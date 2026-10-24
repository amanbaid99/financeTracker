import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MoneyPlan, PlanGroup } from "@/lib/engine/plan";
import { formatINR } from "@/lib/format";

const GROUPS: { id: PlanGroup; title: string; blurb: string }[] = [
  { id: "essentials", title: "Essentials", blurb: "Paid every month" },
  { id: "set_aside", title: "Set aside", blurb: "For bills that come round later" },
  { id: "debt", title: "Clear debt", blurb: "Costly debt goes first" },
  { id: "save", title: "Save", blurb: "Your safety net" },
  { id: "invest", title: "Invest", blurb: "Working toward your goals" },
  { id: "wants", title: "Spend", blurb: "Guilt-free" },
];

export function MoneyPlanCard({ plan }: { plan: MoneyPlan }) {
  const shown = GROUPS.filter((g) => plan.lines.some((l) => l.group === g.id));
  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle>Your money plan this month</CardTitle>
        <CardDescription>
          {plan.noIncome
            ? "No income right now, so this shows what has to be paid from savings."
            : `Every rupee of your ${formatINR(plan.income)} monthly income, with where to keep it. Categories only, never specific funds.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {plan.notes.map((n) => (
          <p key={n} className="rounded-lg bg-muted p-3 text-sm">
            {n}
          </p>
        ))}
        {shown.map((g) => (
          <section key={g.id} className="space-y-2" aria-labelledby={`plan-${g.id}`}>
            <div className="flex items-baseline justify-between gap-2 border-b pb-1">
              <h3 id={`plan-${g.id}`} className="text-sm font-semibold">
                {g.title} <span className="font-normal text-muted-foreground">· {g.blurb}</span>
              </h3>
              <span className="tabular text-sm font-semibold">{formatINR(plan.totals[g.id])}</span>
            </div>
            <ul className="space-y-2">
              {plan.lines
                .filter((l) => l.group === g.id)
                .map((l, i) => (
                  <li key={`${l.label}-${i}`} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{l.label}</p>
                      {(l.where || l.note) && (
                        <p className="text-xs text-muted-foreground">
                          {l.where}
                          {l.where && l.note ? " · " : ""}
                          {l.note}
                        </p>
                      )}
                    </div>
                    <span className="tabular shrink-0">{formatINR(l.amount)}</span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
        {!plan.noIncome && plan.unassigned > 0 && (
          <p className="text-xs text-muted-foreground">{formatINR(plan.unassigned)} left over from rounding.</p>
        )}
      </CardContent>
    </Card>
  );
}
