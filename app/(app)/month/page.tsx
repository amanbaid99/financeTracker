import type { Metadata } from "next";
import Link from "next/link";
import { AddBankAccount, BankBalanceRow } from "@/components/bank-panel";
import { MonthBills } from "@/components/month-bills";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMonthBills, monthStart, type Bill } from "@/lib/bills";
import { loadAnalysis } from "@/lib/data";
import { formatINR } from "@/lib/format";
import { HOLDING_KIND_LABELS, LIABILITY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "This month" };

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default async function MonthPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active = tab === "bank" ? "bank" : "bills";
  const { raw, data, today } = await loadAnalysis();
  const month = monthStart(today);

  const bills: Bill[] = buildMonthBills({
    todayISO: today,
    cards: raw.cards.map((c) => ({
      id: c.id,
      label: c.label,
      outstanding: c.outstanding,
      dueDay: c.due_day,
      statementDay: c.statement_day,
    })),
    monthBills: raw.monthBills.map((r) => ({
      id: r.id,
      month: r.month,
      seriesId: r.series_id,
      label: r.label,
      amount: r.amount,
      dueDay: r.due_day,
      recurring: r.recurring,
      cardId: r.card_id,
    })),
    emis: raw.liabilities
      .filter((l) => (l.emi ?? 0) > 0 && l.outstanding > 0)
      .map((l) => ({ id: l.id, label: `${l.label || LIABILITY_LABELS[l.kind]} EMI`, emi: l.emi ?? 0 })),
    insurance: raw.insurance.map((p) => ({
      id: p.id,
      label: `${p.kind === "term" ? "Term" : p.kind === "health" ? "Health" : "Other"} insurance${p.covers === "others" ? " (family)" : ""}`,
      premium: p.premium,
      frequency: p.premium_frequency as "monthly" | "quarterly" | "half_yearly" | "yearly",
      debitDay: p.debit_day,
      renewalDate: p.renewal_date,
      renewalMonth: p.renewal_month,
    })),
    planned: raw.planned.map((p) => ({ id: p.id, name: p.name, amount: p.amount, nextDue: p.next_due })),
    sips: raw.holdings
      .filter((h) => (h.monthly_sip ?? 0) > 0)
      .map((h) => ({ id: h.id, label: h.name || HOLDING_KIND_LABELS[h.kind], sip: h.monthly_sip ?? 0 })),
  });

  // Planned expenses roll forward once paid, so show this month's paid ones too.
  const paidKeys = raw.billStatus.filter((b) => b.paid).map((b) => b.bill_key);
  for (const key of paidKeys) {
    if (!key.startsWith("plan:") || bills.some((b) => b.key === key)) continue;
    const [, id, due] = key.split(":");
    const p = raw.planned.find((x) => x.id === id);
    if (p) {
      bills.push({ key, kind: "planned", label: p.name, amount: p.amount, dueDate: due ?? null, status: "due", plannedId: id });
    }
  }

  const banks = raw.holdings.filter((h) => h.kind === "savings");
  const bankTotal = banks.reduce((s, h) => s + h.current_value, 0);
  const cardTotal = (data.cards ?? []).reduce((s, c) => s + c.outstanding, 0);
  const paid = new Set(paidKeys);
  // Card bills ticked as paid this month have already left the bank. A card
  // whose bill isn't generated yet still counts its spend so far.
  const cardUnpaid = bills
    .filter((b) => b.kind === "card" && !paid.has(b.key))
    .reduce((s, b) => s + (b.amount ?? b.estimate ?? 0), 0);
  const otherUnpaid = bills
    .filter((b) => b.kind !== "card" && !paid.has(b.key))
    .reduce((s, b) => s + (b.amount ?? 0), 0);
  const left = bankTotal - cardUnpaid - otherUnpaid;
  const [, m] = today.split("-").map(Number);

  return (
    <main className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{MONTH_NAMES[m - 1]}</h1>
        <p className="text-sm text-muted-foreground">What&apos;s due this month and where your money stands.</p>
      </div>

      <div role="tablist" aria-label="This month" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {[
          { id: "bills", label: "Bills", href: "/month" },
          { id: "bank", label: "Bank & dues", href: "/month?tab=bank" },
        ].map((t) => (
          <Link
            key={t.id}
            href={t.href}
            role="tab"
            aria-selected={active === t.id}
            className={cn(
              "rounded-md py-2 text-center text-sm font-medium text-muted-foreground",
              active === t.id && "bg-card text-foreground shadow-xs",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {active === "bills" ? (
        <Card>
          <CardHeader>
            <CardTitle>Bills this month</CardTitle>
            <CardDescription>
              Card bills, EMIs, insurance, planned expenses and your own bills, plus SIPs. Bills that aren&apos;t out yet
              show as not generated; add the amount when they arrive, and tick each one as you pay it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <MonthBills bills={bills} paidKeys={paidKeys} month={month} />
            <p className="text-xs text-muted-foreground">
              Manage{" "}
              <Link href="/details/cards?from=month" className="text-primary underline">
                cards
              </Link>
              ,{" "}
              <Link href="/details/planned?from=month" className="text-primary underline">
                planned expenses
              </Link>
              ,{" "}
              <Link href="/details/insurance" className="text-primary underline">
                insurance
              </Link>{" "}
              or{" "}
              <Link href="/details/liabilities" className="text-primary underline">
                loans
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Where you stand</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y text-sm">
                <div className="flex justify-between py-2">
                  <dt>Bank balance</dt>
                  <dd className="tabular font-medium">{formatINR(bankTotal)}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt>Card bills still to pay</dt>
                  <dd className="tabular font-medium">-{formatINR(cardUnpaid)}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt>Other bills still to pay this month</dt>
                  <dd className="tabular font-medium">-{formatINR(otherUnpaid)}</dd>
                </div>
                <div className="flex justify-between py-2 text-base font-semibold">
                  <dt>Left after dues</dt>
                  <dd className={cn("tabular", left < 0 && "text-danger")}>{formatINR(left)}</dd>
                </div>
              </dl>
              {left < 0 && (
                <p className="mt-2 rounded-lg bg-danger-soft p-2 text-xs text-danger">
                  Your bank balance doesn&apos;t cover everything due. Pay the card bills first to avoid interest.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bank accounts</CardTitle>
              <CardDescription>Update balances whenever you check your bank app.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {banks.length > 0 ? (
                <ul className="divide-y">
                  {banks.map((h) => (
                    <BankBalanceRow
                      key={`${h.id}-${h.current_value}`}
                      id={h.id}
                      label={h.name || "Bank account"}
                      value={h.current_value}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No bank accounts yet.</p>
              )}
              <AddBankAccount />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Credit cards</CardTitle>
                <Link
                  href="/details/cards?from=month"
                  className="text-sm text-primary underline-offset-2 hover:underline"
                >
                  {raw.cards.length ? "Update" : "Add cards"}
                </Link>
              </div>
              <CardDescription>Paid in full each month, so not counted as debt.</CardDescription>
            </CardHeader>
            <CardContent>
              {raw.cards.length ? (
                <ul className="divide-y text-sm">
                  {raw.cards.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.statement_day ? `Bill on ${c.statement_day}` : ""}
                          {c.statement_day && c.due_day ? " · " : ""}
                          {c.due_day ? `due on ${c.due_day}` : ""}
                        </p>
                      </div>
                      <span className="tabular">{formatINR(c.outstanding)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between py-2 font-semibold">
                    <span>Total outstanding</span>
                    <span className="tabular">{formatINR(cardTotal)}</span>
                  </li>
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No cards added.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
