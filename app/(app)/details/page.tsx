import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAnalysis } from "@/lib/data";
import { formatINR, formatINRCompact } from "@/lib/format";

export const metadata: Metadata = { title: "My details" };

const CITY: Record<string, string> = { metro: "Metro", tier2: "Tier 2 city", tier3: "Tier 3 city" };

export default async function DetailsPage() {
  const { raw, data, analysis } = await loadAnalysis();
  const p = raw.profile;
  const answered = (s: string) => p.answered_sections.includes(s);
  const { budget, completeness } = analysis;
  const notYet = "Not added yet";

  const health = data.insurance.filter((x) => x.kind === "health" && x.source !== "employer" && x.covers !== "others");
  const term = data.insurance.filter((x) => x.kind === "term");
  const family = data.insurance.filter((x) => x.covers === "others");
  const debt = data.liabilities.reduce((s, l) => s + l.outstanding, 0);
  const holdingsTotal = data.holdings.reduce((s, h) => s + h.currentValue, 0);

  const sections: { href: string; title: string; summary: string }[] = [
    {
      href: "/details/basics",
      title: "Basics and look",
      summary: [p.name, data.profile.age ? `${data.profile.age} yrs` : "", p.city_tier ? CITY[p.city_tier] : ""]
        .filter(Boolean)
        .join(" · "),
    },
    {
      href: "/details/household",
      title: "Household",
      summary: answered("household")
        ? [
            p.marital_status ? p.marital_status[0].toUpperCase() + p.marital_status.slice(1) : "",
            `${p.dependents ?? 0} dependent${p.dependents === 1 ? "" : "s"}`,
            p.sole_earner ? "only earner" : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : notYet,
    },
    {
      href: "/details/income",
      title: "Income",
      summary: `${data.incomes.length} source${data.incomes.length === 1 ? "" : "s"} · base ${formatINR(budget.baseIncome)}/month`,
    },
    {
      href: "/details/expenses",
      title: "Monthly essentials",
      summary:
        data.expenses.length || answered("expenses")
          ? `${formatINR(budget.essentials.expenses)}/month across ${data.expenses.length} item${data.expenses.length === 1 ? "" : "s"}`
          : `${notYet} (estimated at ${formatINR(budget.essentials.expenses)})`,
    },
    {
      href: "/details/insurance",
      title: "Insurance",
      summary:
        data.insurance.length || answered("insurance")
          ? data.insurance.length
            ? [
                `Health ${formatINRCompact(health.reduce((s, x) => s + x.coverAmount, 0))}`,
                term.length ? `Term ${formatINRCompact(term.reduce((s, x) => s + x.coverAmount, 0))}` : "",
                family.length ? `${family.length} for family` : "",
                `premiums ${formatINR(budget.essentials.insurancePremiums)}/month`,
              ]
                .filter(Boolean)
                .join(" · ")
            : "No policies"
          : notYet,
    },
    {
      href: "/details/liabilities",
      title: "Loans and cards",
      summary:
        data.liabilities.length || answered("liabilities")
          ? data.liabilities.length
            ? `${data.liabilities.length} · ${formatINRCompact(debt)} owed · EMIs ${formatINR(budget.essentials.emis)}/month`
            : "No loans or card dues"
          : notYet,
    },
    {
      href: "/details/cards",
      title: "Credit cards (paid in full)",
      summary: raw.cards.length
        ? `${raw.cards.length} card${raw.cards.length === 1 ? "" : "s"} · ${formatINR(raw.cards.reduce((s, c) => s + c.outstanding, 0))} outstanding`
        : notYet,
    },
    {
      href: "/details/planned",
      title: "Planned expenses",
      summary: raw.planned.length
        ? `${raw.planned.length} · ${formatINR(budget.essentials.planned)}/month set aside`
        : "Gym, servicing, repairs and other costs that come round",
    },
    {
      href: "/holdings",
      title: "Savings and investments",
      summary:
        data.holdings.length || answered("holdings")
          ? `${data.holdings.length} holding${data.holdings.length === 1 ? "" : "s"} · ${formatINRCompact(holdingsTotal)}`
          : notYet,
    },
    {
      href: "/goals",
      title: "Goals",
      summary: data.goals.length ? `${data.goals.length} goal${data.goals.length === 1 ? "" : "s"}` : notYet,
    },
    {
      href: "/details/risk",
      title: "Risk comfort",
      summary: p.risk_profile
        ? p.risk_profile[0].toUpperCase() + p.risk_profile.slice(1)
        : "Not answered (using moderate)",
    },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">My details</h1>
        <p className="text-sm text-muted-foreground">
          Everything your plan is built on. Tap a section to update it; your plan recalculates straight away.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profile {completeness.score}% complete</CardTitle>
          {completeness.topMissing[0] && <CardDescription>{completeness.topMissing[0].why}</CardDescription>}
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {sections.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="flex items-center gap-3 py-3 hover:text-primary">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.summary}</p>
                  </div>
                  <span className="text-xs text-primary">Edit</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
