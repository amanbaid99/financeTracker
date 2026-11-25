import {expect,it} from "vitest";
import {prepareBudgetEdit} from "@/lib/budget-edit-preview";
import {composeGuidedBudget} from "@/lib/budget-guide";
import {budgetSipAmount} from "@/lib/budget-sip-amount";
import {sipTotal} from "@/lib/budget-sips";
const before={...composeGuidedBudget(200000,[{id:"fixed",name:"Fixed",category:"fixed",mode:"amount",value:68015,loanId:null}],[],91985),sips:[{id:"a",label:"Goal A",amount:70000,goalId:null,investmentId:null},{id:"b",label:"Goal B",amount:1000,goalId:null,investmentId:null,locked:true}]};
it("previews the existing salary rebalance and exact SIP scaling without mutating the saved sheet",()=>{
 const snapshot=JSON.stringify(before);const next=prepareBudgetEdit(before,{...before,salary:170000});expect(budgetSipAmount(next)).toBe(61985);expect(sipTotal(next.sips!)).toBe(61985);expect(next.sips![1].amount).toBe(1000);expect(JSON.stringify(before)).toBe(snapshot);
});
it("clearing SIP amounts leaves every budget amount intact",()=>{
 const next=prepareBudgetEdit(before,{...before,sips:[]});expect(next.sips).toEqual([]);expect(next.rows).toEqual(before.rows);expect(next.salary).toBe(before.salary);expect(budgetSipAmount(next)).toBe(91985);
});
