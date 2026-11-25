// The two numbers at the top of Net worth: what you save a month (Save &
// invest from your budget) and how much of it goes into investments (Your
// SIPs on Budget, or the SIPs on your holdings when none are set). Pure.

import type { BudgetSheet } from "./budget-sheet";
import { budgetSipAmount } from "./budget-sip-amount";
import { sipTotal } from "./budget-sips";

export type MoneyFlow = {
  /** Save & invest a month, or null with no saved budget or no salary. */
  saving: number | null;
  /** Saving as a share of take-home, 0 to 100, or null. */
  savingRate: number | null;
  /** Going into investments a month. */
  investing: number;
  /** Saved but not put into a SIP, or null without a budget. */
  notInvested: number | null;
};

export function moneyFlow(
  plan: BudgetSheet | null,
  saved: boolean,
  holdingSips: number,
): MoneyFlow {
  const saving = budgetSipAmount(plan, saved);
  const planned = sipTotal(plan?.sips ?? []);
  const investing = planned > 0 ? planned : holdingSips;
  const salary = plan?.salary ?? 0;
  return {
    saving,
    savingRate:
      saving !== null && salary > 0
        ? Math.round((saving / salary) * 100)
        : null,
    investing,
    notInvested: saving !== null ? Math.max(0, saving - investing) : null,
  };
}
