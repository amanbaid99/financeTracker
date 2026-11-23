import {it,expect} from "vitest";
import {calculateHybrid} from "@/lib/hybrid-engine";
import {hybridBillsForecast} from "@/lib/bills-fund";
import {trackGoal,type GoalInput,type Investment} from "@/lib/tracker";
import {readGoalPlanning} from "@/lib/hybrid-settings";
const today="2026-11-23";
const bills=[{name:"Annual payment",amount:12000,everyMonths:12,nextDue:"2027-05-23"}];
const goal:GoalInput={id:"safety",name:"Emergency / sinking fund",type:"bills_fund",target:312000,targetDate:null,inflationPct:null,emergencyReserve:300000,emergencyReserveDate:"2027-12-31",bills};
const inv:Investment={id:"cash",name:"Liquid fund",kind:"mutual_fund",category:"liquid_fund",value:300000,monthlySip:0,returnPct:0,valuationDate:today};
const links=[{goalId:goal.id,investmentId:inv.id,percent:100}];
it("a single goal counts its linked investment once and reserves emergency money before bills",()=>{
 const r=calculateHybrid({today,goals:[goal],investments:[inv],links,monthlySavings:20000});
 expect(r.goals).toHaveLength(1);expect(r.goals[0].existingCoverage).toBe(300000);expect(r.goals[0].targetCorpus).toBe(312000);
 expect(r.goals[0].requiredMonthly).toBeGreaterThan(0);expect(r.totalMonthlyAllocated).toBeLessThanOrEqual(20000);
 const tracked=trackGoal(goal,[inv],links,today);expect(tracked.billsFund!.upcoming[0].covered).toBe(false);expect(tracked.futureTarget).toBeGreaterThanOrEqual(300000);
});
it("does not count a reserve as cash available to pay an immediate bill",()=>{
 const state=hybridBillsForecast([{...bills[0],nextDue:today}],300000,0,today,300000);
 expect(state.immediateShortfall).toBe(12000);expect(state.target).toBe(312000);
});
it("builds the reserve and replenishes annual bills in one contribution",()=>{
 const state=hybridBillsForecast(bills,0,0,today,300000,12);
 expect(state.requiredMonthly).toBe(25000+2000);
 expect(hybridBillsForecast(bills,0,state.requiredMonthly,today,300000,12).cashflowShortfall).toBe(0);
 expect(hybridBillsForecast(bills,0,1000,today,300000,12).cashflowShortfall).toBeGreaterThan(0);
});
it("keeps reserve settings editable and preserves the original deadline",()=>{
 expect(readGoalPlanning({emergencyReserve:300000,emergencyReserveDate:"2027-12-31"})).toEqual({emergencyReserve:300000,emergencyReserveDate:"2027-12-31"});
});
it("planned withdrawals from the combined goal protect the reserve unless explicitly allowed",async()=>{
 const {planWithdrawal}=await import("@/lib/withdrawal-plan");
 const holding={...inv,value:312000};const tracked={...trackGoal(goal,[holding],links,today),confirmedMapping:true};
 const opts={amount:20000,goalId:goal.id,goals:[tracked],investments:[holding],today};
 expect(planWithdrawal(opts).available).toBe(12000);expect(planWithdrawal(opts).short).toBe(8000);
 expect(planWithdrawal({...opts,allowEmergencyReserve:true}).available).toBe(20000);
});
