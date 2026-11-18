import type { Metadata } from "next";
import Link from "next/link";
import { GuideButton } from "@/components/guides";
import { NetWorthCard } from "@/components/net-worth-card";
import { HomeOverview } from "@/components/home-overview";
import { UpdatesDue } from "@/components/updates-due";
import { loadGoals, loadCards, loadLoans, loadCurrentNetWorth, loadSnapshot, loadRunway } from "@/lib/data";
import { updatesDue } from "@/lib/updates";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const [g, c, loans, worth, snapshot, runway] = await Promise.all([
    loadGoals(), loadCards(), loadLoans(), loadCurrentNetWorth(), loadSnapshot(), loadRunway(),
  ]);
  const due = updatesDue({
    today: g.today, cards: c.cards, loans,
    lastCas: snapshot.settings?.last_cas_import_at ?? null,
    hasFunds: g.investments.some((i) => i.kind === "mutual_fund" || i.kind === "gold"),
    snoozes: (snapshot.settings?.update_snoozes ?? {}) as Record<string, unknown>,
  });
  return <main className="space-y-5">
    <header>
      <div className="flex items-center gap-1"><h1 className="text-2xl font-semibold tracking-tight">Home</h1><GuideButton id="home" /></div>
      <p className="text-sm text-muted-foreground">Your money at a glance.</p>
    </header>
    <div className="space-y-2">
      <NetWorthCard history={[{ day: g.today, ...worth }]} />
      <Link href="/assets" className="inline-flex min-h-10 items-center text-sm font-medium text-primary">View net worth and holdings →</Link>
    </div>
    <UpdatesDue items={due} today={g.today} />
    <HomeOverview goals={g.goals} cards={c.cards} loans={loans} today={g.today} between={runway.active} />
  </main>;
}
