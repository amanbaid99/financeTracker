import {expect,it} from "vitest";
import {goalRequiredSip} from "@/lib/goal-required-sip";
import {trackGoal,type GoalInput,type Investment} from "@/lib/tracker";
import type {TrackedGoal} from "@/lib/tracker";
const goal={futureTarget:120000,current:0,returnPct:0,months:12,monthlySip:15000,extraSipNeeded:0} as TrackedGoal;
it("shows total required funding rather than an existing overlarge SIP",()=>{expect(goalRequiredSip(goal)).toBe(10000);});
it("counts existing corpus and uses recurring bill requirements",()=>{expect(goalRequiredSip({...goal,current:60000})).toBe(5000);expect(goalRequiredSip({...goal,billsFund:{monthlyNeed:1234.5} as TrackedGoal["billsFund"]})).toBe(1235);});
it("omits estimates without a viable deadline and handles funded goals",()=>{expect(goalRequiredSip({...goal,months:null})).toBeNull();expect(goalRequiredSip({...goal,months:0})).toBeNull();expect(goalRequiredSip({...goal,current:120000})).toBe(0);});

it("shows monthly foreclosure savings after future EMIs, existing savings and foreclosure charges",()=>{
 const input:GoalInput={id:"loan-goal",name:"Close loan",type:"loan_payoff",target:0,targetDate:"2027-03-26",inflationPct:null,loan:{outstanding:120000,ratePct:0,emi:10000,monthsLeft:12,asOf:"2026-11-26",emiDay:26,foreclosurePct:4,foreclosureGst:true}};
 const holding:Investment={id:"savings",kind:"bank",name:"Existing savings",category:null,value:20000,monthlySip:0,returnPct:0};
 const goal=trackGoal(input,[holding],[{goalId:input.id,investmentId:holding.id,percent:100}],"2026-11-26");
 expect(goal.futureTarget).toBe(83776);
 expect(goalRequiredSip(goal)).toBe(15944);
 // This is saving on top of the separate ₹10,000 EMI, not EMI added again.
 expect(goalRequiredSip(goal)).toBeLessThan(83776/4);
 const covered=trackGoal({...input,targetDate:"2028-03-26"},[holding],[{goalId:input.id,investmentId:holding.id,percent:100}],"2026-11-26");
 expect(covered.emisCloseFirst).toBe(true);expect(goalRequiredSip(covered)).toBe(0);
 expect(goalRequiredSip(trackGoal({...input,targetDate:null},[holding],[],"2026-11-26"))).toBeNull();
});
