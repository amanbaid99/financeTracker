import {it,expect} from "vitest";
import {savedBudgetInputs} from "@/lib/planner-budget";
import {budget} from "@/lib/budget";
import {composeGuidedBudget} from "@/lib/budget-guide";
const loan={id:"00000000-0000-4000-8000-000000000001",name:"Loan",emi:10000};
it("the current guided budget supplies SIP capacity, counting personal costs and EMI once",()=>{
 const sheet=composeGuidedBudget(170000,[{id:"rent",name:"Rent",category:"fixed",mode:"amount",value:58015,loanId:null},{id:"emi",name:"EMI",category:"fixed",mode:"amount",value:10000,loanId:loan.id}], [loan],61985);
 expect(sheet.standalone).toBe(true);
 const inputs=savedBudgetInputs(sheet,[loan])!;const result=budget({...inputs,sips:20000});
 expect(result).toMatchObject({income:170000,costs:98015,emis:10000,planMonthly:61985});
 expect(result.free).toBe(41985);
});
it("does not add an intentionally excluded loan back into a guided budget",()=>{
 const sheet=composeGuidedBudget(100000,[{id:"rent",name:"Rent",category:"fixed",mode:"amount",value:40000,loanId:null}],[loan],30000);
 expect(budget({...savedBudgetInputs(sheet,[loan])!,sips:0}).planMonthly).toBe(30000);
 expect(savedBudgetInputs(sheet,[loan])!.emis).toBe(0);
});
it("no-salary budgets never fall back to old income records",()=>{
 const sheet=composeGuidedBudget(170000,[],[],0,true);
 expect(budget({...savedBudgetInputs(sheet,[])!,sips:10000}).planMonthly).toBe(0);
 expect(savedBudgetInputs(null,[])).toBeNull();expect(()=>savedBudgetInputs({invalid:true},[])).toThrow();
});
