import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BudgetSummary, UseForPlan } from "@/components/budget-card";
import { BudgetEditor } from "@/components/budget-editor";
import { loadBudget } from "@/lib/data";
import { formatINR } from "@/lib/format";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage() {
  const {
    incomes,
    costs,
    loanEmis,
    sips,
    plan,
    budget: b,
  } = await loadBudget();
  return (
    <main className="space-y-5">
      <Link
        href="/goals"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> Goals
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
        <p className="text-sm text-muted-foreground">
          What comes in, what&apos;s fixed, and what&apos;s free to invest each
          month. A plan, not a spend tracker.
        </p>
      </div>
      <section
        className="space-y-3 rounded-2xl border bg-card p-4"
        aria-label="Your month"
      >
        <BudgetSummary b={b} />
        <UseForPlan b={b} planMonthly={plan?.monthly ?? null} />
      </section>
      <BudgetEditor incomes={incomes} costs={costs} />
      <section aria-labelledby="auto-h" className="space-y-2">
        <h2 id="auto-h" className="font-semibold">
          From the rest of the app
        </h2>
        <ul className="divide-y rounded-2xl border bg-card px-4 text-sm">
          {loanEmis.map((l) => (
            <li key={l.name} className="flex justify-between gap-3 py-3">
              <span className="min-w-0 break-words">EMI · {l.name}</span>
              <span className="tabular shrink-0">{formatINR(l.emi)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 py-3">
            <span>SIPs running</span>
            <span className="tabular shrink-0">{formatINR(sips)}</span>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          EMIs come from{" "}
          <Link
            href="/cards"
            className="text-primary underline underline-offset-2"
          >
            Credit
          </Link>{" "}
          and SIPs from{" "}
          <Link
            href="/portfolio"
            className="text-primary underline underline-offset-2"
          >
            Portfolio
          </Link>
          . Yearly payments like insurance belong in a bills fund goal, which is
          already a SIP, so they aren&apos;t counted again here. Card spends you
          get paid back for aren&apos;t costs either.
        </p>
      </section>
    </main>
  );
}
