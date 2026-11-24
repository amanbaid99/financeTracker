import { expect, it } from "vitest";
import { sipContributionDelay, sipReviewDue } from "@/lib/sip-start";
import { calculateHybrid, type HybridInput } from "@/lib/hybrid-engine";
import { hybridBillsForecast } from "@/lib/bills-fund";
const input: HybridInput = {today:"2026-11-24",monthlySavings:40000,allocationMode:"safety_deadline",goals:[{id:"goal",name:"Goal",type:"custom",target:120000,targetType:"future",targetDate:"2027-11-24",inflationPct:0,expectedReturnPct:0}],investments:[],links:[]};
it("delays January contributions without shifting today's valuation or deadline",()=>{
 const before=calculateHybrid(input),after=calculateHybrid({...input,contributionStartMonth:"2027-01"});
 expect(sipContributionDelay(input.today,"2027-01")).toBe(1);
 expect(before.goals[0].requiredMonthly).toBe(10000);
 expect(after.goals[0].requiredMonthly).toBe(10910);
 expect(after.goals[0].targetDate).toBe("2027-11-24");expect(after.calculatedOn).toBe(input.today);
 expect(after.goals[0].targetCorpus).toBe(before.goals[0].targetCorpus);
 expect(after.goals[0].assumptions.skippedContributionMonths).toBe(1);
});
it("keeps existing investment growth and inflation on the original horizon",()=>{
 const data={...input,goals:[{...input.goals[0],targetType:"today" as const,inflationPct:6,expectedReturnPct:4}],investments:[{id:"held",name:"Held savings",category:"savings_account",kind:"savings" as const,value:10000,monthlySip:0,returnPct:4}],links:[{goalId:"goal",investmentId:"held",percent:100}]};
 const a=calculateHybrid(data),b=calculateHybrid({...data,contributionStartMonth:"2027-04"});
 expect(b.goals[0].targetCorpus).toBe(a.goals[0].targetCorpus);expect(b.goals[0].projectedExistingCorpus).toBe(a.goals[0].projectedExistingCorpus);expect(b.goals[0].requiredMonthly).toBeGreaterThan(a.goals[0].requiredMonthly);
});
it("does not invent a contribution before the selected start or after the deadline",()=>{
 const r=calculateHybrid({...input,contributionStartMonth:"2028-01"});
 expect(r.totalMonthlyAllocated).toBe(0);expect(r.goals[0].projectedCorpus).toBe(0);expect(r.goals[0].status).toBe("underfunded");expect(r.goals[0].warnings.join()).toContain("No monthly contribution fits");
 const b=hybridBillsForecast([{name:"Payment",amount:6000,nextDue:"2026-12-24",everyMonths:0}],0,10000,input.today,0,12,1);
 expect(b.immediateShortfall).toBe(6000);expect(b.cashflowShortfall).toBe(6000);
});
it("prompts a review only after saving and no earlier than the start month",()=>{
 expect(sipReviewDue("2026-12-01","2026-11-24","2027-01")).toBe(false);expect(sipReviewDue("2027-01-01","2026-11-24","2027-01")).toBe(true);expect(sipReviewDue("2027-01-25","2027-01-01","2027-01")).toBe(false);expect(sipReviewDue("2027-02-01","2027-01-25","2027-01")).toBe(true);
});
it("preserves old plans, rejects invalid months and handles elapsed starts",()=>{
 expect(sipContributionDelay(input.today)).toBe(0);expect(sipContributionDelay(input.today,"2026-01")).toBe(0);expect(()=>sipContributionDelay(input.today,"2027-13")).toThrow(/valid/);
 const prior=calculateHybrid(input),snapshot=JSON.stringify(prior);calculateHybrid({...input,contributionStartMonth:"2027-01"});expect(JSON.stringify(prior)).toBe(snapshot);
});
