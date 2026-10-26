// Which card to use next. Plain arithmetic on milestones, deadlines and the
// person's usual monthly card spend. No AI, nothing saved.

import {
  averageBill,
  milestoneState,
  type Card,
  type MilestoneState,
} from "@/lib/cards";

export const SPEND_CATEGORIES = {
  travel: "Travel",
  dining: "Dining",
  groceries: "Groceries",
  fuel: "Fuel",
  online: "Online shopping",
  bills: "Bills and utilities",
  upi: "UPI",
  international: "International",
} as const;
export type SpendCategory = keyof typeof SPEND_CATEGORIES;
export const SPEND_CATEGORY_KEYS = Object.keys(
  SPEND_CATEGORIES,
) as SpendCategory[];

export type PlanStatus = "chase" | "stretch" | "unlikely";

export interface PlannedMilestone {
  cardId: string;
  cardLabel: string;
  milestone: MilestoneState;
  status: PlanStatus;
  /** Extra spend a month this milestone needs on top of earlier ones on the same card. */
  perMonth: number;
}

export interface CardAdvice {
  /** Usual total card spend a month, from logged bills; null with none. */
  capacity: number | null;
  plan: PlannedMilestone[];
  /** Spend a month left after the milestones being chased. */
  spare: number | null;
  pick: { cardId: string; cardLabel: string; reason: string } | null;
  /** Cards suited to the chosen category, best first. */
  forCategory: { cardId: string; cardLabel: string }[];
}

const monthsLeft = (s: MilestoneState) =>
  Math.max((s.daysLeft ?? 0) / 30.44, 1 / 30.44);

/**
 * Plans milestones soonest deadline first. Each is "chase" when the usual
 * spend still left over covers it, "stretch" when it would take up to half
 * as much again, else "unlikely".
 */
export function adviseCards(
  cards: Card[],
  todayISO: string,
  category: SpendCategory | null = null,
): CardAdvice {
  const usual = cards
    .map((c) => averageBill(c.bills))
    .filter((n): n is number => n !== null);
  const capacity = usual.length ? usual.reduce((a, b) => a + b, 0) : null;

  const open = cards.flatMap((c) =>
    c.milestones
      .map((m) => milestoneState(m, todayISO, c))
      .filter((s) => s.end && s.status !== "achieved" && s.status !== "missed")
      .map((s) => ({ card: c, s })),
  );
  open.sort(
    (a, b) => a.s.end!.localeCompare(b.s.end!) || a.s.target - b.s.target,
  );

  let left = capacity ?? 0;
  const perCard = new Map<string, number>();
  const plan: PlannedMilestone[] = [];
  for (const { card, s } of open) {
    const already = perCard.get(card.id) ?? 0;
    const need = Math.max(0, Math.ceil(s.remaining / monthsLeft(s)) - already);
    let status: PlanStatus = "unlikely";
    if (capacity !== null && need <= left) status = "chase";
    else if (capacity !== null && need <= left + capacity * 0.5)
      status = "stretch";
    if (status === "chase") {
      left -= need;
      perCard.set(card.id, already + need);
    }
    plan.push({
      cardId: card.id,
      cardLabel: card.label,
      milestone: s,
      status,
      perMonth: need,
    });
  }

  const matches = (c: Card) =>
    category !== null && c.bestFor.includes(category);
  const forCategory = category
    ? cards.filter(matches).map((c) => ({ cardId: c.id, cardLabel: c.label }))
    : [];

  const chasing = plan.filter((p) => p.status === "chase");
  const stretching = plan.filter((p) => p.status === "stretch");
  let pick: CardAdvice["pick"] = null;
  const first = (list: PlannedMilestone[]) =>
    list.find((p) => matches(cards.find((c) => c.id === p.cardId)!)) ?? list[0];
  const chosen = chasing.length
    ? first(chasing)
    : stretching.length
      ? first(stretching)
      : null;
  if (chosen) {
    const all = plan.filter(
      (p) => p.cardId === chosen.cardId && p.status === chosen.status,
    );
    const top = all[all.length - 1].milestone;
    const prize = all
      .map((p) => p.milestone.reward || p.milestone.name)
      .join(" and ");
    pick = {
      cardId: chosen.cardId,
      cardLabel: chosen.cardLabel,
      reason: `${formatRupees(top.remaining)} more by ${shortDate(top.end!)} gets ${prize}.`,
    };
  } else if (forCategory.length) {
    pick = {
      ...forCategory[0],
      reason: `Suits ${SPEND_CATEGORIES[category!].toLowerCase()} and no milestone needs it more.`,
    };
  }

  return {
    capacity,
    plan,
    spare: capacity === null ? null : Math.max(0, left),
    pick,
    forCategory,
  };
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const formatRupees = (n: number) => `₹${inr.format(n)}`;
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const shortDate = (iso: string) =>
  `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
