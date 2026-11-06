import type { Card } from "./cards";
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

/** Preview active goals without repeating reached or already-covered groups. */
export function homeGoals(goals: TrackedGoal[]): TrackedGoal[] {
  const groups = groupGoals(goals);
  return sortGoals([...groups.attention, ...groups.growing]).slice(0, 3);
}
