import { expect, it } from "vitest";
import { calculatePersonalBudget, groupPersonalCosts } from "@/lib/personal-budget";
import { composeGuidedBudget } from "@/lib/budget-guide";
it("calculates a transparent monthly estimate and validates days and rupees",()=>{
 expect(calculatePersonalBudget(5000,300,22,8000)).toEqual({transport:5000,everyday:6600,fun:8000,total:19600});
 for(const days of [-1,32,22.5])expect(calculatePersonalBudget(0,100,days,0)).toBeNull();
 expect(calculatePersonalBudget(0,1.5,30,0)).toBeNull();expect(calculatePersonalBudget(1e9,100,30,0)).toBeNull();
});
it("groups transport without changing the budget total or mutating records",()=>{
 const p=composeGuidedBudget(100000,[{id:"commute",name:"Daily commute",category:"fixed",mode:"amount",value:5000,loanId:null}],[],40000);
 delete p.personalGrouping;
 const original=structuredClone(p),grouped=groupPersonalCosts(p);
 expect(grouped.rows.find(r=>r.id==="commute")?.category).toBe("personal");expect(grouped.rows.find(r=>r.id==="rule-personal")?.value).toBe(55000);
 expect(p).toEqual(original);expect(grouped.rules).toEqual(p.rules);
});

it("respects a manual bucket choice after the initial grouping",()=>{
 const p=groupPersonalCosts(composeGuidedBudget(100000,[],[],40000));
 const edited={...p,rows:[...p.rows,{id:"transport",name:"Transport",category:"fixed" as const,mode:"amount" as const,value:2000,loanId:null}]};
 expect(groupPersonalCosts(edited).rows.find(r=>r.id==="transport")?.category).toBe("fixed");
});
