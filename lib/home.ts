import { orderGoals } from "./goal-order";
import type { TrackedGoal } from "./tracker";
import { milestoneState, type Card } from "./cards";
import { cardEmis, loanView, type Loan } from "./loans";
import { addMonths } from "./dates";
import { formatDate, formatINR } from "./format";
import { goalStatus } from "./goal-status";
import { milestoneLabel } from "./milestone-label";
import type { UpdateDue } from "./updates";

/** Use the same priority order as Goals; completed goals leave the focus list. */
export function focusGoals(goals: TrackedGoal[], today: string) {
  return orderGoals(goals, today)
    .filter((g) => g.status !== "reached")
    .slice(0, 3);
}

/** The unfinished milestone with the least eligible spending left, using eligible statement spending. */
export function nextMilestone(cards: Card[], loans: Loan[], today: string) {
  return (
    cards
      .flatMap((card) =>
        card.milestones
          .filter((m) => m.target > 0)
          .map((m) => ({
            card,
            state: milestoneState(m, today, {
              ...card,
              emiPerBill: cardEmis(loans, card.id, today),
            }),
          })),
      )
      .filter(
        ({ state }) => state.status !== "achieved" && state.status !== "missed",
      )
      .sort(
        (a, b) =>
          a.state.remaining - b.state.remaining ||
          b.state.progress - a.state.progress ||
          (a.state.end ?? "9999").localeCompare(b.state.end ?? "9999"),
      )[0] ?? null
  );
}

// ---- Home redesign: status, this month, coming up. Pure; callers pass today.

const dayNum = (iso: string) =>
  Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) /
  86400000;
const daysUntil = (from: string, to: string) =>
  Math.round(dayNum(to) - dayNum(from));
const shortDate = (iso: string) => formatDate(iso).replace(/ \d{4}$/, "");

export interface Payment {
  key: string;
  name: string;
  amount: number;
  date: string;
  kind: "card" | "emi";
  overdue: boolean;
  href: string;
}

/**
 * Loan EMIs due within `days`. Card bills aren't tracked as paid or unpaid
 * here, and EMIs of loans on a card are part of that card's bill.
 */
export function upcomingPayments(
  loans: Loan[],
  today: string,
  days = 30,
): Payment[] {
  const out: Payment[] = [];
  for (const l of loans) {
    if (l.cardId) continue;
    const next = loanView(l, today).next;
    if (next && daysUntil(today, next.date) <= days)
      out.push({
        key: `emi-${l.id}-${next.date}`,
        name: `${l.name} EMI`,
        amount: next.amount,
        date: next.date,
        kind: "emi",
        overdue: false,
        href: "/assets",
      });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export type HomeTone = "success" | "warning" | "danger";

/** One line on whether you're okay, and why not when you aren't. */
export function homeStatus({
  payments,
  goals,
  today,
  between = false,
}: {
  payments: Payment[];
  goals: TrackedGoal[];
  today: string;
  between?: boolean;
}): { tone: HomeTone; text: string } {
  const late = payments.find((p) => p.overdue);
  if (late)
    return {
      tone: "danger",
      text: `${late.name} of ${formatINR(late.amount)} was due ${shortDate(late.date)}.`,
    };
  for (const g of focusGoals(goals, today)) {
    const s = goalStatus(g, today, between);
    if (s.tone !== "danger" && s.tone !== "warning") continue;
    const short = g.cover?.short ?? 0;
    const when = g.billsFund?.short?.by ?? g.targetDate;
    const amount = g.billsFund?.short?.amount ?? short;
    return {
      tone: s.tone,
      text:
        amount > 0
          ? `${g.name} is ${formatINR(amount)} short${when ? ` by ${formatDate(when)}` : ""}.`
          : `${g.name} is behind. Open it to see what helps.`,
    };
  }
  return { tone: "success", text: "You're on track." };
}

/** Months of essential costs the emergency fund covers, or null without one. */
export function emergencyMonths(
  goals: TrackedGoal[],
  essentialsMonthly: number,
): number | null {
  const g = goals.find((x) => x.type === "emergency_fund"||(x.emergencyReserve??0)>0);
  if (!g || essentialsMonthly <= 0) return null;
  return Math.floor(((g.emergencyReserve?Math.min(g.current,g.emergencyReserve):g.current) / essentialsMonthly) * 10) / 10;
}

/** The milestone, but only when it's close: little left or ending soon. */
export function closeMilestone(cards: Card[], loans: Loan[], today: string) {
  const m = nextMilestone(cards, loans, today);
  if (!m) return null;
  const soon = m.state.end ? daysUntil(today, m.state.end) <= 30 : false;
  return m.state.remaining <= 10000 || soon ? m : null;
}

/**
 * Card bills to log: from the 1st of each month, last month's bill for any
 * card that doesn't have one yet. Stays until they're all logged.
 */
export function cardBillNudge(
  cards: Card[],
  today: string,
): { missing: number; month: string } | null {
  const month = addMonths(`${today.slice(0, 7)}-01`, -1);
  const missing = cards.filter(
    (c) => !c.bills.some((b) => b.month === month),
  ).length;
  return missing ? { missing, month } : null;
}

/** Everything to do this month: reminders, and a card milestone when it's close. */
export function thisMonth({
  updates,
  milestone,
}: {
  updates: UpdateDue[];
  milestone: ReturnType<typeof closeMilestone>;
}): UpdateDue[] {
  const ms: UpdateDue[] = milestone
    ? [
        {
          key: `milestone-${milestone.card.id}`,
          title: `${milestone.card.label}: ${formatINR(milestone.state.remaining)} to the milestone`,
          detail: milestoneLabel(milestone.state),
          href: `/cards?open=${encodeURIComponent(milestone.card.id)}`,
          actionLabel: "Open",
          snooze: false,
        },
      ]
    : [];
  // Card statements have their own one-line nudge on Home.
  return [...updates.filter((u) => !u.key.startsWith("statement:")), ...ms];
}
