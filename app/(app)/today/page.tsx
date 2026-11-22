import type { Metadata } from "next";
import { GuideButton } from "@/components/guides";
import {
  CardBillNudge,
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
import {
  cardBillNudge,
  closeMilestone,
  emergencyMonths,
  homeStatus,
  thisMonth,
  upcomingPayments,
} from "@/lib/home";
import { homeNextUp, missingVehicleCues } from "@/lib/home-cues";
import { updatesDue } from "@/lib/updates";

export const metadata: Metadata = { title: "Home" };

const DAY = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * Home: are you okay, card bills to log, reminders, EMIs coming up, your
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
  const payments = upcomingPayments(loans, today);
  const todo = thisMonth({
    updates: homeNextUp(due, cues),
    milestone: closeMilestone(c.cards, loans, today),
  });
  const bills = cardBillNudge(c.cards, today);
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
      <HomeStatus
        tone={status.tone}
        text={status.text}
        todo={todo.length + (bills ? 1 : 0)}
      />
      {bills && <CardBillNudge missing={bills.missing} month={bills.month} />}
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
