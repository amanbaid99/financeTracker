import { parseISODate } from "@/lib/engine/dates";
import type { InsurancePolicy } from "@/lib/engine/types";
import { formatDate, monthName } from "@/lib/format";

export interface Reminder {
  id: string;
  text: string;
  href: string;
}

/** In-app reminders: insurance renewals due this month or next, and the next advance tax date. */
export function buildReminders(opts: {
  todayISO: string;
  insurance: InsurancePolicy[];
  nextAdvanceTaxDate: string | null;
  taxWindowDays?: number;
}): Reminder[] {
  const out: Reminder[] = [];
  const t = parseISODate(opts.todayISO);
  const nextMonth = (t.m % 12) + 1;
  for (const p of opts.insurance) {
    if (!p.renewalMonth || p.source === "employer") continue;
    if (p.renewalMonth === t.m || p.renewalMonth === nextMonth) {
      out.push({
        id: `ins-${p.id}`,
        text: `Your ${p.kind === "term" ? "term" : p.kind === "health" ? "health" : ""} insurance renews in ${monthName(p.renewalMonth)}. Keep the premium ready so cover doesn't lapse.`.replace("  ", " "),
        href: "/onboarding/insurance",
      });
    }
  }
  if (opts.nextAdvanceTaxDate) {
    const days = Math.round(
      (Date.parse(opts.nextAdvanceTaxDate) - Date.parse(opts.todayISO)) / 86_400_000,
    );
    if (days <= (opts.taxWindowDays ?? 45)) {
      out.push({
        id: "advance-tax",
        text: `Advance tax instalment due ${formatDate(opts.nextAdvanceTaxDate)}${days === 0 ? " (today)" : ` (in ${days} days)`}. Pay it from your tax reserve.`,
        href: "/budget",
      });
    }
  }
  return out;
}
