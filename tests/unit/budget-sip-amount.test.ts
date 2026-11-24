import { expect, it } from "vitest";
import { budgetSipAmount } from "@/lib/budget-sip-amount";
import type { BudgetSheet } from "@/lib/budget-sheet";
const sheet: BudgetSheet={version:2,salary:200000,rows:[{id:"fixed",name:"Fixed",category:"fixed",mode:"amount",value:68015,loanId:null},{id:"personal",name:"Personal",category:"personal",mode:"amount",value:40000,loanId:null}],excludedLoanIds:[],rules:{savings:{mode:"amount",value:0},investing:{mode:"amount",value:0},future:{mode:"amount",value:91985}}};
it("uses the exact Save and invest total without double-counting generated rule rows",()=>{
 expect(budgetSipAmount(sheet)).toBe(91985);
 expect(budgetSipAmount({...sheet,rows:[...sheet.rows,{id:"rule-savings",name:"Save",category:"savings",mode:"amount",value:91985,loanId:null}]})).toBe(91985);
});
it("preserves a real zero and leaves no-salary or missing budgets manual",()=>{
 expect(budgetSipAmount({...sheet,rules:undefined})).toBe(0);expect(budgetSipAmount({...sheet,noSalary:true})).toBeNull();expect(budgetSipAmount(null)).toBeNull();expect(budgetSipAmount(sheet,false)).toBeNull();
});
