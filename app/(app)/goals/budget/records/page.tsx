import Link from "next/link";
import type { Metadata } from "next";
import { BudgetPlanner } from "@/components/budget-planner";
import { loadBudget, loadRunway } from "@/lib/data";
export const metadata: Metadata = { title: "Income and cost records" };
export default async function BudgetRecordsPage() {
  const [b, runway] = await Promise.all([loadBudget(), loadRunway()]);
  return <main className="space-y-5">
    <Link href="/goals/budget" className="inline-flex min-h-10 items-center text-sm text-primary">← Budget</Link>
    <header><h1 className="text-2xl font-semibold tracking-tight">Income and cost records</h1><p className="text-sm text-muted-foreground">The recorded amounts used by your goal and SIP plan.</p></header>
    <BudgetPlanner incomes={b.incomes} costs={b.costs} loanEmis={b.loanEmis} sips={b.sips} planMonthly={b.plan?.monthly ?? null} between={runway.active} />
  </main>;
}
