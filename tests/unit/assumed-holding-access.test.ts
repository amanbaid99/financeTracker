import {expect,it} from "vitest";
import {calculateHybrid,unallocatedLiquidValue} from "@/lib/hybrid-engine";
import {planWithdrawal} from "@/lib/withdrawal-plan";
import {trackGoal,type GoalInput,type Investment} from "@/lib/tracker";
const today="2026-11-23";
const holding:Investment={id:"tax-saver",name:"Tax saver fund",kind:"mutual_fund",category:"elss",value:50000,monthlySip:0,returnPct:0,availability:"locked",accessibleOn:"2030-01-01"};
const goal:GoalInput={id:"wedding",name:"Wedding",type:"wedding",target:100000,targetDate:"2028-01-01",inflationPct:0,expectedReturnPct:0};
const links=[{goalId:goal.id,investmentId:holding.id,percent:100}];
it("counts linked ELSS value for a wedding without an access-date gate",()=>{
 const before=JSON.stringify(holding);const result=calculateHybrid({today,goals:[goal],investments:[holding],links,monthlySavings:0});
 expect(result.goals[0].existingCoverage).toBe(50000);expect(result.goals[0].warnings.join(" ")).not.toContain("Unavailable holding");expect(JSON.stringify(holding)).toBe(before);
});
it("includes the same holding in a selected-goal withdrawal preview without modifying holdings",()=>{
 const before=JSON.stringify(holding);const tracked=trackGoal(goal,[holding],links,today);const result=planWithdrawal({today,goals:[tracked],investments:[holding],goalId:goal.id,amount:10000});
 expect(result.available).toBe(10000);expect(result.short).toBe(0);expect(JSON.stringify(holding)).toBe(before);
});
it("makes only unassigned shares available for extra-money planning",()=>{
 expect(unallocatedLiquidValue([holding],[],today)).toBe(50000);expect(unallocatedLiquidValue([holding],links,today)).toBe(0);
});
