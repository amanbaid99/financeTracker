import type { Metadata } from "next";
import { GuideButton } from "@/components/guides";
import {
  ComingUp,
  HomeGoals,
  HomeStatus,
  MoneySummary,
} from "@/components/home-sections";
import { UpdatesDue } from "@/components/updates-due";
import {
  loadCards,
  loadCurrentNetWorth,
  loadLoans,
  loadMoneyPlan,
  loadRunway,
  loadSnapshot,
} from "@/lib/data";
import { formatINR } from "@/lib/format";
import {
  closeMilestone,
  emergencyMonths,
  homeStatus,
  thisMonth,
  upcomingPayments,
} from "@/lib/home";
import { homeNextUp, missingVehicleCues } from "@/lib/home-cues";
import { planSteps } from "@/lib/sip-plan";
import { updatesDue } from "@/lib/updates";

export const metadata: Metadata = { title: "Home" };

const DAY = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * Home: are you okay, what to do this month, what's going out soon, your
 * goals, then your money in small numbers.
 */
export default async function HomePage() {
  const [g, c, loans, worth, snapshot, runway] = await Promise.all([
    loadMoneyPlan(),
    loadCards(),
    loadLoans(),
    loadCurrentNetWorth(),
    loadSnapshot(),
    loadRunway(),
  ]);
  const today = g.today;
  const snoozes = (snapshot.settings?.update_snoozes ?? {}) as Record<
    string,
    unknown
  >;
  const due = updatesDue({
    today,
    cards: c.cards,
    loans,
    lastCas: snapshot.settings?.last_cas_import_at ?? null,
    hasFunds: g.investments.some(
      (i) => i.kind === "mutual_fund" || i.kind === "gold",
    ),
    snoozes,
  });
  const cues = missingVehicleCues({
    goals: g.goals,
    investments: g.investments,
    links: g.links,
    today,
    snoozes,
  });
  const payments = upcomingPayments(c.cards, loans, today);
  const steps = g.plan
    ? planSteps(g.plan.suggestions, g.investments, g.links).map((s) => {
        const amounts = [
          s.addLump ? `${formatINR(s.addLump)} now` : "",
          s.addMonthly ? `${formatINR(s.addMonthly)} a month` : "",
        ]
          .filter(Boolean)
          .join(" and ");
        return {
          key: s.key,
          title: `Put ${amounts} into ${s.investment ? s.label : `a ${s.label.toLowerCase()}`}`,
          detail: s.goals.length
            ? `For ${s.goals.map((x) => x.name).join(", ")}`
            : "From your plan",
        };
      })
    : [];
  const todo = thisMonth({
    payments,
    updates: homeNextUp(due, cues),
    steps,
    milestone: closeMilestone(c.cards, loans, today),
    today,
  });
  const status = homeStatus({
    payments,
    goals: g.goals,
    today,
    between: runway.active,
  });
  const essentials = g.budget.costs + g.budget.emis;

  return (
    <main className="space-y-4">
      <header className="space-y-0.5">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
          <GuideButton id="home" />
        </div>
        <p className="text-sm text-muted-foreground">
          {DAY.format(new Date(`${today}T00:00:00Z`))}
        </p>
      </header>
      <HomeStatus tone={status.tone} text={status.text} todo={todo.length} />
      <UpdatesDue items={todo} today={today} compact title="This month" />
      <ComingUp payments={payments} />
      <HomeGoals
        goals={g.goals}
        today={today}
        between={runway.active}
        emergencyMonths={emergencyMonths(g.goals, essentials)}
      />
      <MoneySummary
        assets={worth.assets}
        liabilities={worth.liabilities}
        spare={g.allocation.spareTotal}
      />
    </main>
  );
}
