// "Suggest amounts" on Budget: one split of the monthly amount into SIP rows,
// using the planner's rules (emergency fund first at its pace, then bills,
// ₹500 for every other goal, then the nearest goal; one or two holdings per
// goal). It fills rows once; you change them by hand after. Pure.

import { sipWorksheetBaseline } from "./sip-worksheet";
import type { SipRow } from "./budget-sips";
import type { Investment, Link, TrackedGoal } from "./tracker";

export function suggestSipRows(opts: {
  goals: TrackedGoal[];
  investments: Investment[];
  links: Link[];
  today: string;
  /** Save & invest a month, or null with no salary (then: what goals need). */
  budgetMonthly: number | null;
  essentialsMonthly: number;
  riskTolerance?: "conservative" | "moderate" | "aggressive" | null;
}): SipRow[] {
  const run = (monthly: number) =>
    sipWorksheetBaseline({
      goals: opts.goals,
      investments: opts.investments,
      links: opts.links,
      today: opts.today,
      riskTolerance: opts.riskTolerance,
      monthlySavings: monthly,
      monthlyPlanLimit: monthly,
      monthlyEssentials: opts.essentialsMonthly,
      includeAlternatives: false,
      allocationMode: "safety_deadline",
    });
  try {
    const amount =
      opts.budgetMonthly !== null && opts.budgetMonthly > 0
        ? opts.budgetMonthly
        : run(1e9).totalMonthlyRequired;
    if (amount <= 0) return [];
    const result = run(amount);
    const held = new Set(opts.investments.map((i) => i.id));
    return (result.vehicles ?? []).flatMap((v) =>
      v.parts
        .filter((p) => p.monthly > 0)
        .map((p, i) => {
          const id = v.key.startsWith("inv:") ? v.key.slice(4) : null;
          return {
            id: `suggested-${v.key}-${p.goalId}-${i}`.slice(0, 100),
            investmentId: id && held.has(id) ? id : null,
            label: v.label
              .replace(/^(Essentials|Separate): /, "A new ")
              .slice(0, 80),
            amount: p.monthly,
            goalId: /^[0-9a-f-]{36}$/i.test(p.goalId) ? p.goalId : null,
          };
        }),
    );
  } catch {
    return [];
  }
}
