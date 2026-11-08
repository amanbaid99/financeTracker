import type { Card } from "./cards";
import { isLiquid } from "./categories";
import { groupGoals, sortGoals } from "./goal-summary";
import type { TrackedGoal } from "./tracker";

/** Statement months describe logged bills, never unbilled or live spending. */
export function homeCardSummary(cards: Card[], today: string) {
  const currentMonth = today.slice(0, 7);
  const month =
    cards
      .flatMap((c) => c.bills.map((b) => b.month.slice(0, 7)))
      .filter((m) => m <= currentMonth)
      .sort()
      .at(-1) ?? null;
  const statements = cards.flatMap((c) =>
    c.bills.filter((b) => b.month.slice(0, 7) === month),
  );
  return {
    month,
    total: statements.reduce((sum, b) => sum + b.amount, 0),
    cardsUpdated: cards.filter((c) =>
      c.bills.some((b) => b.month.slice(0, 7) === month),
    ).length,
    cards: cards.length,
    unpaid: cards
      .flatMap((c) => c.bills)
      .filter((b) => !b.paid)
      .reduce((sum, b) => sum + b.amount, 0),
  };
}

/** Preview active savings goals without repeating reached or already-covered groups. */
export function homeGoals(goals: TrackedGoal[]): TrackedGoal[] {
  const groups = groupGoals(goals);
  // Loans have their own place in Credit, so they aren't previewed as goals.
  return sortGoals([...groups.attention, ...groups.growing])
    .filter((g) => !g.loanState)
    .slice(0, 3);
}

/**
 * This month's dues against money you can reach quickly, and how long what's
 * left would last at your usual monthly costs and EMIs. Liquid means savings
 * accounts, FDs and liquid funds, including ones set aside for goals.
 */
export function cashCheck(opts: {
  /** Overdue and current-month payments still to make. */
  dues: number[];
  investments: { kind: string; category: string | null; value: number }[];
  /** Usual monthly costs plus EMIs; 0 when not known. */
  monthlyOut: number;
}) {
  const due = opts.dues.reduce((s, n) => s + n, 0);
  const liquid = Math.round(
    opts.investments
      .filter((i) => isLiquid(i.kind, i.category))
      .reduce((s, i) => s + i.value, 0),
  );
  const after = liquid - due;
  const months =
    opts.monthlyOut > 0 && after > 0
      ? Math.floor((after / opts.monthlyOut) * 10) / 10
      : opts.monthlyOut > 0
        ? 0
        : null;
  return { due, liquid, after, monthlyOut: opts.monthlyOut, months };
}
