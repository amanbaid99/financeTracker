import {readBudgetSheet,rowAmount,type SheetLoan} from "./budget-sheet";
import type {Income,Cost} from "./budget";

/** Use the budget shown in Budget, including guided sheets, for SIP capacity. */
export function savedBudgetInputs(raw:unknown,loans:SheetLoan[]){
 if(raw==null)return null;
 const sheet=readBudgetSheet(raw,0,loans);
 if(!sheet)throw Error("Your saved budget could not be read. Open Budget and review it before planning SIPs.");
 return {
  incomes:[{id:"budget-income",label:"Take-home income",type:"stable_salary",amount:sheet.noSalary?0:sheet.salary,active:true}] as Income[],
  costs:sheet.rows.filter(r=>!r.loanId&&r.category!=="savings"&&r.category!=="investing").map(r=>({id:r.id,name:r.name,amount:rowAmount(r,sheet.salary)})) as Cost[],
  emis:sheet.rows.filter(r=>!!r.loanId).reduce((sum,r)=>sum+rowAmount(r,sheet.salary),0),
 };
}
