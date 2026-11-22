import { orderGoals } from "./goal-order";
import type { TrackedGoal } from "./tracker";
import { milestoneState, type Card } from "./cards";
import { cardEmis, loanView, type Loan } from "./loans";
import { formatDate, formatINR } from "./format";
import { goalStatus } from "./goal-status";
import { milestoneLabel } from "./milestone-label";
import type { UpdateDue } from "./updates";


/** Use the same priority order as Goals; completed goals leave the focus list. */
export function focusGoals(goals: TrackedGoal[], today: string) {
  return orderGoals(goals, today).filter((g) => g.status !== "reached").slice(0, 3);
}

/** The unfinished milestone with the least eligible spending left, using eligible statement spending. */
export function nextMilestone(cards: Card[], loans: Loan[], today: string) {
  return cards.flatMap((card) => card.milestones
    .filter((m) => m.target > 0)
    .map((m) => ({ card, state: milestoneState(m, today, {
      ...card, emiPerBill: cardEmis(loans, card.id, today),
    }) })))
    .filter(({ state }) => state.status !== "achieved" && state.status !== "missed")
    .sort((a, b) => a.state.remaining - b.state.remaining || b.state.progress - a.state.progress || (a.state.end ?? "9999").localeCompare(b.state.end ?? "9999"))[0] ?? null;
}

// ---- Home redesign: status, this month, coming up. Pure; callers pass today.


const dayNum = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
const daysUntil = (from: string, to: string) => Math.round(dayNum(to) - dayNum(from));
const shortDate = (iso: string) => formatDate(iso).replace(/ \d{4}$/, "");

export interface Payment {
  key: string;
  name: string;
  amount: number;
  date: string;
  kind: "card" | "emi";
  overdue: boolean;
  href: string;
  billId?: string;
  loanId?: string;
}

/**
 * Card bills not yet paid and loan EMIs due within `days`. EMIs of loans on
 * a card are part of that card's bill, so they aren't counted twice.
 */
export function upcomingPayments(cards: Card[], loans: Loan[], today: string, days = 30): Payment[] {
  const out: Payment[] = [];
  for (const c of cards)
    for (const b of c.bills)
      if (!b.paid && b.dueDate && b.amount > 0 && daysUntil(today, b.dueDate) <= days)
        out.push({ key: `bill-${b.id}`, name: `${c.label} bill`, amount: b.amount, date: b.dueDate, kind: "card", overdue: b.dueDate < today, href: `/cards?open=${encodeURIComponent(c.id)}`, billId: b.id });
  for (const l of loans) {
    if (l.cardId) continue;
    const next = loanView(l, today).next;
    if (next && daysUntil(today, next.date) <= days)
      out.push({ key: `emi-${l.id}-${next.date}`, name: `${l.name} EMI`, amount: next.amount, date: next.date, kind: "emi", overdue: false, href: "/assets", loanId: l.id });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export type HomeTone = "success" | "warning" | "danger";

/** One line on whether you're okay, and why not when you aren't. */
export function homeStatus({ payments, goals, today, between = false }: { payments: Payment[]; goals: TrackedGoal[]; today: string; between?: boolean }): { tone: HomeTone; text: string } {
  const late = payments.find((p) => p.overdue);
  if (late) return { tone: "danger", text: `${late.name} of ${formatINR(late.amount)} was due ${shortDate(late.date)}.` };
  for (const g of focusGoals(goals, today)) {
    const s = goalStatus(g, today, between);
    if (s.tone !== "danger" && s.tone !== "warning") continue;
    const short = g.cover?.short ?? 0;
    const when = g.billsFund?.short?.by ?? g.targetDate;
    const amount = g.billsFund?.short?.amount ?? short;
    return {
      tone: s.tone,
      text: amount > 0
        ? `${g.name} is ${formatINR(amount)} short${when ? ` by ${shortDate(when)}` : ""}.`
        : `${g.name} is behind. Open it to see what helps.`,
    };
  }
  return { tone: "success", text: "You're on track." };
}

/** Months of essential costs the emergency fund covers, or null without one. */
export function emergencyMonths(goals: TrackedGoal[], essentialsMonthly: number): number | null {
  const g = goals.find((x) => x.type === "emergency_fund");
  if (!g || essentialsMonthly <= 0) return null;
  return Math.floor((g.current / essentialsMonthly) * 10) / 10;
}

/** The milestone, but only when it's close: little left or ending soon. */
export function closeMilestone(cards: Card[], loans: Loan[], today: string) {
  const m = nextMilestone(cards, loans, today);
  if (!m) return null;
  const soon = m.state.end ? daysUntil(today, m.state.end) <= 30 : false;
  return m.state.remaining <= 10000 || soon ? m : null;
}

/** Everything to do this month, most urgent first. */
export function thisMonth({ payments, updates, steps, milestone, today }: {
  payments: Payment[];
  updates: UpdateDue[];
  steps: { key: string; title: string; detail: string }[];
  milestone: ReturnType<typeof closeMilestone>;
  today: string;
}): UpdateDue[] {
  const pay = (p: Payment): UpdateDue => ({
    key: p.key,
    title: `Pay ${p.name}: ${formatINR(p.amount)}`,
    detail: p.overdue ? `Was due ${shortDate(p.date)}` : p.date === today ? "Due today" : `Due ${shortDate(p.date)}`,
    href: p.href,
    actionLabel: "Open",
    snooze: false,
    pay: p.billId ? { billId: p.billId } : p.loanId ? { loanId: p.loanId, dueDate: p.date } : undefined,
  });
  const soon = payments.filter((p) => p.overdue || daysUntil(today, p.date) <= 10).map(pay);
  const plan = steps.map((s): UpdateDue => ({ key: `step-${s.key}`, title: s.title, detail: s.detail, href: "/goals/plan", actionLabel: "Open plan", snooze: false }));
  const ms: UpdateDue[] = milestone ? [{
    key: `milestone-${milestone.card.id}`,
    title: `${milestone.card.label}: ${formatINR(milestone.state.remaining)} to the milestone`,
    detail: milestoneLabel(milestone.state),
    href: `/cards?open=${encodeURIComponent(milestone.card.id)}`,
    actionLabel: "Open",
    snooze: false,
  }] : [];
  return [...soon, ...updates, ...plan, ...ms];
}
