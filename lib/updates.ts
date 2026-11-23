import { addMonths, emiDateIn, parseISODate, todayIST } from "./dates";
import type { Card } from "./cards";
import type { Loan } from "./loans";

export interface UpdateDue {
  key: string;
  title: string;
  detail: string;
  href: string;
  actionLabel?: string;
  optional?: boolean;
  /** False for things that can't wait (payments, plan steps): no Tomorrow button. */
  snooze?: boolean;
}

/** Missing information asks for an update, never implies a missed payment. */
export function updatesDue({
  today,
  cards,
  loans,
  lastCas,
  hasFunds,
  snoozes = {},
}: {
  today: string;
  cards: Card[];
  loans: Loan[];
  lastCas: string | null;
  hasFunds: boolean;
  snoozes?: Record<string, unknown>;
}): UpdateDue[] {
  const month = today.slice(0, 7);
  const items: UpdateDue[] = [];
  for (const c of cards) {
    if (!c.statementDay) continue;
    const { y, m } = parseISODate(today);
    const latest =
      emiDateIn(y, m, c.statementDay) <= today
        ? `${month}-01`
        : addMonths(`${month}-01`, -1);
    if (c.bills.some((b) => b.month === latest)) continue;
    items.push({
      key: `statement:${c.id}:${latest}`,
      title: `Log ${c.label} statement`,
      actionLabel:"Log bill",
      detail: `${new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(latest))}. Add the statement amount for milestone progress.`,
      href: `/cards?do=${encodeURIComponent(`bill:${c.id}:${latest.slice(0, 7)}`)}`,
    });
  }
  // Stable review periods: time passing is not a missed payment or failed plan.
  for (const l of loans) {
    const last=l.confirmedOn??l.asOf;
    const reviewOn=addMonths(last,3);
    if(l.outstanding<=0||today<reviewOn)continue;
    items.push({key:`loan:${l.id}:${reviewOn}`,title:`Review ${l.name} balance`,
      optional:true,actionLabel:"Review balance",detail:"An optional quarterly check against your lender. Scheduled progress is estimated; no payment is assumed confirmed.",href:`/updates?loan=${l.id}`});
  }
  const lastCasDay=lastCas?todayIST(new Date(lastCas)):null;
  const casReviewOn=lastCasDay?addMonths(lastCasDay,3):null;
  if(hasFunds&&(!casReviewOn||today>=casReviewOn))items.push({
    key:`cas:${casReviewOn??"initial"}`,title:"Review investment balances",optional:true,actionLabel:"Upload CAS",
    detail:"Optional quarterly refresh. Your recorded balances and saved plan remain available until you choose to update them.",href:"/import"});
  return items.filter(
    (i) =>
      typeof snoozes[i.key] !== "string" || (snoozes[i.key] as string) <= today,
  );
}
