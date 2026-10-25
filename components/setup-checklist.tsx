import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { FinanceData } from "@/lib/engine/types";

interface Item {
  key: string;
  label: string;
  why: string;
  href: string;
  done: boolean;
}

/** Sections a new user hasn't filled in yet, each with why it matters and where to add it. */
export function setupItems(data: FinanceData): Item[] {
  const a = data.profile.answered;
  return [
    {
      key: "expenses",
      label: "Monthly expenses",
      why: "So your emergency fund target is real, not a guess.",
      href: "/details/expenses",
      done: data.expenses.length > 0 || a.includes("expenses"),
    },
    {
      key: "holdings",
      label: "Savings and investments",
      why: "So we know how much safety net you already have.",
      href: data.holdings.length ? "/holdings" : "/holdings/new",
      done: data.holdings.length > 0 || a.includes("holdings"),
    },
    {
      key: "insurance",
      label: "Insurance",
      why: "Cover comes before investing.",
      href: "/details/insurance",
      done: data.insurance.length > 0 || a.includes("insurance"),
    },
    {
      key: "liabilities",
      label: "Loans and cards",
      why: "Costly debt changes what comes first.",
      href: "/details/liabilities",
      done: data.liabilities.length > 0 || a.includes("liabilities"),
    },
    {
      key: "goals",
      label: "Goals",
      why: "Give your savings a job, starting with retirement.",
      href: "/goals/new?type=retirement",
      done: data.goals.length > 0 || a.includes("goals"),
    },
    {
      key: "household",
      label: "Household",
      why: "Dependents change how much cover and safety net you need.",
      href: "/details/household",
      done: a.includes("household") || data.profile.maritalStatus !== null,
    },
    {
      key: "risk",
      label: "Risk comfort",
      why: "Three quick questions to pick the right mix for long goals.",
      href: "/details/risk",
      done: data.profile.riskProfile !== null,
    },
  ];
}

export function SetupChecklist({ data }: { data: FinanceData }) {
  const items = setupItems(data);
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;
  // Show what's left first, finished items after.
  const ordered = [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Finish setting up</CardTitle>
          <span className="tabular text-sm text-muted-foreground">
            {done} of {items.length}
          </span>
        </div>
        <CardDescription>Add these whenever you have a minute. Each one sharpens your plan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={(done / items.length) * 100} label="Setup progress" />
        <ul className="divide-y">
          {ordered.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="flex items-center gap-3 py-2.5 hover:text-primary">
                {i.done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Done" />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground" aria-label="To do" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${i.done ? "text-muted-foreground" : ""}`}>{i.label}</p>
                  {!i.done && <p className="text-xs text-muted-foreground">{i.why}</p>}
                </div>
                {!i.done && (
                  <span className="flex items-center text-xs font-medium text-primary">
                    Add <ChevronRight className="size-4" aria-hidden />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
