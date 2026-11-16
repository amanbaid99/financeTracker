import { ChevronRight, CreditCard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ComingUp } from "@/components/coming-up";
import { CreditPaymentProvider } from "@/components/credit-payment";
import { GuideButton } from "@/components/guides";
import { LoanList } from "@/components/loan-list";
import { RunwayCard } from "@/components/runway-card";
import { loadCards, loadLoans, loadRunway } from "@/lib/data";
import { formatINR } from "@/lib/format";
import { monthYear } from "@/lib/goal-summary";
import { liabilities } from "@/lib/liabilities";

export const metadata: Metadata = { title: "Liabilities" };

export default async function LiabilitiesPage() {
  const [{ cards, today }, loans, r] = await Promise.all([
    loadCards(),
    loadLoans(),
    loadRunway(),
  ]);
  const l = liabilities({
    today,
    loans,
    bills: r.bills,
    items: r.items,
    choices: r.choices,
    monthlyLiving: r.monthlyLiving,
    until: r.active ? r.salaryWorst : null,
  });
  return (
    <main className="space-y-5">
      <div>
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Liabilities</h1>
          <GuideButton id="cards" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          What you owe, and what&apos;s due when.
        </p>
      </div>

      <section
        aria-label="What you owe"
        data-guide="owed"
        className="surface-card space-y-3 rounded-2xl border bg-card p-4"
      >
        <div>
          <p className="text-xs text-muted-foreground">You owe</p>
          <p className="tabular mt-0.5 text-3xl font-semibold tracking-tight">
            {formatINR(l.owed)}
          </p>
          {l.debtFree && (
            <p className="mt-1 text-xs text-muted-foreground">
              Loans paid off by {monthYear(l.debtFree)} at your EMIs
            </p>
          )}
        </div>
        <dl className="space-y-1.5 border-t pt-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Loans</dt>
            <dd className="tabular font-medium">{formatINR(l.loans)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">
              Card dues and other payments
            </dt>
            <dd className="tabular font-medium">{formatINR(l.payments)}</dd>
          </div>
          {l.monthlyEmi > 0 && (
            <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
              <dt>EMIs a month</dt>
              <dd className="tabular">{formatINR(l.monthlyEmi)}</dd>
            </div>
          )}
        </dl>
      </section>

      {r.active && r.runway && <RunwayCard view={{ runway: r.runway }} />}

      <CreditPaymentProvider>
        <ComingUp
          items={l.upcoming}
          until={l.until}
          total={l.dueTotal}
          between={r.active}
        />
        <LoanList
          loans={loans}
          cards={cards.map((c) => ({ id: c.id, label: c.label }))}
          today={today}
        />
      </CreditPaymentProvider>

      <Link
        href="/liabilities/cards"
        data-guide="cards-link"
        className="surface-card press flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 hover:border-primary/40"
      >
        <span
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
          aria-hidden
        >
          <CreditCard className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Cards and milestones</span>
          <span className="block text-xs text-muted-foreground">
            {cards.length === 0
              ? "Track fee waivers and bonus points"
              : `${cards.length} ${cards.length === 1 ? "card" : "cards"}. Log statements and see how close you are to rewards.`}
          </span>
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </Link>
    </main>
  );
}
