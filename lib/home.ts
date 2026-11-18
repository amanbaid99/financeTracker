import { orderGoals } from "./goal-order";
import type { TrackedGoal } from "./tracker";
import { milestoneState, type Card } from "./cards";
import { cardEmis, type Loan } from "./loans";

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
