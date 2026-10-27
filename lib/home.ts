// The Home screen: what needs the person today, and one line per section.
// Pure functions; "today" is passed in.

import { adviseCards } from "./card-advisor";
import { type Card, milestoneState, headlineMilestone } from "./cards";
import { formatDate, formatINR } from "./format";
import { goalHeadline } from "./goal-summary";
import type { TrackedGoal } from "./tracker";

export type Urgency = "danger" | "warning" | "nudge";

export interface NeedsYou {
  key: string;
  title: string;
  detail: string;
  href: string;
  urgency: Urgency;
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const dayMonth = (iso: string) =>
  formatDate(iso).split(" ").slice(0, 2).join(" ");
const days = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const prevMonth = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return m === 1
    ? `${y - 1}-12-01`
    : `${y}-${String(m - 1).padStart(2, "0")}-01`;
};

/** Things worth doing today, most urgent first. */
export function needsYou(
  goals: TrackedGoal[],
  cards: Card[],
  todayISO: string,
): NeedsYou[] {
  const out: NeedsYou[] = [];

  for (const g of goals) {
    const h = goalHeadline(g);
    const href = `/goals?open=${g.id}`;
    if (g.status === "overdue")
      out.push({
        key: `g-${g.id}`,
        title: g.name,
        detail: h.text,
        href,
        urgency: "danger",
      });
    else if (g.billsFund?.firstShort || g.status === "behind")
      out.push({
        key: `g-${g.id}`,
        title: g.name,
        detail: h.text,
        href,
        urgency: "warning",
      });
  }

  for (const c of cards) {
    const href = `/cards?open=${c.id}`;
    for (const b of c.bills) {
      if (b.paid || !b.dueDate) continue;
      const left = days(todayISO, b.dueDate);
      if (left < 0)
        out.push({
          key: `b-${b.id}`,
          title: `${c.label} bill overdue`,
          detail: `${formatINR(b.amount)}, was due ${dayMonth(b.dueDate)}`,
          href,
          urgency: "danger",
        });
      else if (left <= 7)
        out.push({
          key: `b-${b.id}`,
          title: `${c.label} bill due ${left === 0 ? "today" : left === 1 ? "tomorrow" : dayMonth(b.dueDate)}`,
          detail: formatINR(b.amount),
          href,
          urgency: "warning",
        });
    }
    // A card with bills but none for last month: remind to log it.
    const latest = c.bills[0]?.month;
    if (latest && latest < prevMonth(`${todayISO.slice(0, 7)}-01`)) {
      const missing = prevMonth(`${todayISO.slice(0, 7)}-01`);
      out.push({
        key: `log-${c.id}`,
        title: `Log your ${MONTHS[Number(missing.slice(5, 7)) - 1]} ${c.label} bill`,
        detail: "So its milestones stay up to date",
        href,
        urgency: "nudge",
      });
    }
  }

  // Card milestones worth chasing, soonest first.
  const advice = adviseCards(cards, todayISO);
  for (const p of advice.plan) {
    if (p.status !== "chase" && p.status !== "stretch") continue;
    const left = p.milestone.daysLeft ?? 999;
    if (left > 120) continue;
    out.push({
      key: `m-${p.milestone.id}`,
      title: `${p.cardLabel}: ${p.milestone.reward || p.milestone.name}`,
      detail: `${formatINR(p.milestone.remaining)} more by ${dayMonth(p.milestone.end!)}`,
      href: `/cards?open=${p.cardId}`,
      urgency: p.status === "stretch" ? "warning" : "nudge",
    });
  }

  const rank: Record<Urgency, number> = { danger: 0, warning: 1, nudge: 2 };
  return out.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
}

/** One line for the Goals row on Home. */
export function goalsLine(goals: TrackedGoal[]): string {
  if (!goals.length) return "Add your first goal";
  const fine = goals.filter((g) =>
    g.billsFund
      ? !g.billsFund.firstShort && g.billsFund.bills.length > 0
      : g.status === "on_track" || g.status === "reached",
  ).length;
  return `${goals.length} goal${goals.length === 1 ? "" : "s"} · ${fine} on track`;
}

/** One line for the Cards row on Home: the nearest open milestone. */
export function cardsLine(cards: Card[], todayISO: string): string {
  if (!cards.length) return "Add a card to track its milestones";
  const heads = cards
    .map((c) => ({
      c,
      h: headlineMilestone(
        c.milestones.map((m) => milestoneState(m, todayISO, c)),
      ),
    }))
    .filter((x) => x.h && x.h.status !== "achieved" && x.h.status !== "missed")
    .sort((a, b) => (a.h!.end ?? "9999").localeCompare(b.h!.end ?? "9999"));
  const first = heads[0];
  if (!first) return `${cards.length} card${cards.length === 1 ? "" : "s"}`;
  return `${first.c.label}: ${formatINR(first.h!.remaining)} to ${first.h!.reward || first.h!.name}`;
}

/** "Good morning" by the hour in India. */
export function greeting(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(now),
  );
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
