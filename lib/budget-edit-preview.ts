import { applyBudgetRules, type BudgetSheet } from "./budget-sheet";
import { rebalanceBudgetEdit } from "./budget-rebalance";
import { budgetSipAmount } from "./budget-sip-amount";
import { scaleSips } from "./budget-sips";
/** Preview and save use exactly the same existing rebalancing/scaling rules. */
export function prepareBudgetEdit(previous:BudgetSheet|null,next:BudgetSheet):BudgetSheet{
 let result=previous?rebalanceBudgetEdit(previous,next):applyBudgetRules(next);
 const before=previous?budgetSipAmount(previous):null,after=budgetSipAmount(result);
 if(result.sips?.length&&before!==null&&after!==null&&before!==after)result={...result,sips:scaleSips(result.sips,after)};
 return result;
}
