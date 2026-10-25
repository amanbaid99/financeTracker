import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MonthBills } from "@/components/month-bills";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAnalysis } from "@/lib/data";
import { monthStatus } from "@/lib/month-status";

export const metadata: Metadata = { title: "Bills" };

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

export default async function BillsPage() {
  const { raw, data, today } = await loadAnalysis();
  const status = monthStatus(raw, data, today);
  const [, m] = today.split("-").map(Number);

  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Home
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{MONTH_NAMES[m - 1]} bills</h1>
        <p className="text-sm text-muted-foreground">
          Everything due this month. Bills that aren&apos;t out yet show as not generated; add the amount when they
          arrive and tick each one as you pay it.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bills and payments</CardTitle>
          <CardDescription>Card bills, EMIs, insurance, planned expenses, your own bills and SIPs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <MonthBills bills={status.bills} paidKeys={status.paidKeys} month={status.month} />
          <p className="text-xs text-muted-foreground">
            Manage{" "}
            <Link href="/details/cards" className="text-primary underline">
              cards
            </Link>
            ,{" "}
            <Link href="/details/planned" className="text-primary underline">
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
    </main>
  );
}
