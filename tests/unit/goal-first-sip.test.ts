import {expect,it} from "vitest";
import {hybridPlan,hybridVehicles,type HybridPlanInput} from "@/lib/hybrid-plan";
import {splitForGoal} from "@/lib/sip-plan";
import type {GoalInput,Investment} from "@/lib/tracker";
const today="2026-11-23";
const safety:GoalInput={id:"safety",name:"Safety",type:"emergency_fund",target:120000,targetDate:null,expectedReturnPct:0,inflationPct:0};
const near:GoalInput={id:"near",name:"Travel",type:"travel",target:120000,targetDate:"2027-11-23",expectedReturnPct:0,inflationPct:0};
const far:GoalInput={id:"far",name:"Retirement",type:"retirement",target:1200000,targetDate:"2036-11-23",expectedReturnPct:0,inflationPct:0};
const cash=(value:number):Investment=>({id:"cash",name:"Safety account",kind:"savings",category:"savings_account",value,monthlySip:0,returnPct:0,valuationDate:today});
const input=(coverage=0,monthlySavings=40000):HybridPlanInput=>({today,goals:[far,safety,near],investments:[cash(coverage)],links:[{investmentId:"cash",goalId:"safety",percent:100}],monthlySavings,monthlyEssentials:10000,allocationMode:"safety_deadline"});
const amount=(r:ReturnType<typeof hybridPlan>,id:string)=>r.goals.find(g=>g.goalId===id)!.recommendedMonthly;
it("paces the emergency fund to its date (12 months without one), never past that, then goals by deadline",()=>{
 const result=hybridPlan(input());
 // ₹1,20,000 over 12 months; spare money isn't piled onto the emergency fund.
 expect(amount(result,"safety")).toBe(10000);
 expect(amount(result,"near")).toBe(10000);
 expect(amount(result,"far")).toBe(10000);
 expect(amount(hybridPlan(input(0,8000)),"safety")).toBe(8000);
});
it("never goes slower than 1 month of costs within 3 months",()=>{
 const data=input(0,40000);data.goals=data.goals.map(g=>g.id==="safety"?{...g,targetDate:"2031-11-23"}:g);
 // 60 months would be ₹2,000; the floor is ₹10,000 / 3.
 expect(amount(hybridPlan(data),"safety")).toBe(3334);
});
it("puts a small surplus entirely into the missing first month",()=>{
 const result=hybridPlan(input(3000,5000));
 expect(amount(result,"safety")).toBe(5000);
 expect(amount(result,"near")).toBe(0);
});
it("uses existing cover once and funds dates rather than legacy ranks",()=>{
 const data=input(20000,25000);data.goals=data.goals.map(g=>({...g,planRank:g.id==="far"?1:99}));
 const result=hybridPlan(data);
 expect(amount(result,"safety")).toBe(8334);
 expect(amount(result,"near")).toBe(10000);
 expect(amount(result,"far")).toBe(6666);
 expect(result).toEqual(hybridPlan({...data,goals:[...data.goals].reverse(),investments:[...data.investments].reverse()}));
});
it("prioritizes a scheduled bill before a later goal after the safety floor",()=>{
 const data=input(30000,10000);data.goals=[{...safety,type:"bills_fund",emergencyReserve:30000,bills:[{name:"Insurance",amount:20000,everyMonths:0,nextDue:"2027-01-23"}]},near];
 const r=hybridPlan(data);expect(amount(r,"safety")).toBe(10000);expect(amount(r,"near")).toBe(0);
});
it("handles zero surplus, completed goals and excess savings without exceeding requirements",()=>{
 for(const monthly of [0,1,999,1000,1200,10000,1000000]){
  const r=hybridPlan(input(0,monthly));expect(r.totalMonthlyAllocated).toBeLessThanOrEqual(monthly);expect(r.goals.every(g=>g.recommendedMonthly<=g.requiredMonthly)).toBe(true);
  const vehicles=hybridVehicles(input(0,monthly),r);expect(vehicles.reduce((s,v)=>s+v.total,0)).toBe(r.totalMonthlyAllocated);
 }
 const data=input(120000);data.goals[1]={...safety,completed:true};expect(amount(hybridPlan(data),"safety")).toBe(0);
});
it("uses recorded balances despite legacy access flags under the availability assumption",()=>{
 const data=input(20000);data.investments[0]={...cash(20000),availability:"pledged"};
 const r=hybridPlan(data);expect(r.goals.find(g=>g.goalId==="safety")!.assumptions.runway!.accessibleCorpus).toBe(20000);
});
it("does not count the same three-month safety target once per emergency goal",()=>{
 const data=input(0,40000);data.goals.push({...safety,id:"safety2",name:"Other safety"});const r=hybridPlan(data);
 expect(amount(r,"safety")+amount(r,"safety2")).toBe(20000);
 expect(amount(r,"near")).toBe(10000);
});
const funds:Investment[]=Array.from({length:5},(_,i)=>({id:`fund${i}`,name:`Held fund ${i}`,kind:"mutual_fund",category:"equity_index",value:10000,monthlySip:0,returnPct:0}));
const links=funds.map(i=>({investmentId:i.id,goalId:far.id,percent:100}));
it.each([[500,[500]],[1200,[1200]],[2400,[2400]],[5000,[2500,2500]],[6203,[3102,3101]]])("splits %i into one holding, or two from ₹5,000",(monthly,expected)=>{
 const parts=splitForGoal(far.id,"equity_index",monthly as number,0,funds,links,"goal_first",false,far);
 expect(parts.map(p=>p.monthly)).toEqual(expected);
 expect(parts.reduce((s,p)=>s+p.monthly,0)).toBe(monthly);
});
it("does not mutate a previous calculation after a balance change",()=>{
 const data=input();const r=hybridPlan(data);const saved=JSON.stringify(r);hybridPlan({...data,investments:[cash(30000)]});expect(JSON.stringify(r)).toBe(saved);
});

it("keeps overrides exact and rejects a total beyond the available monthly amount",()=>{
 const data=input(0,40000);const r=hybridPlan({...data,overrides:{near:5000}});
 expect(amount(r,"near")).toBe(5000);expect(amount(r,"safety")).toBe(10000);expect(amount(r,"far")).toBe(10000);
 expect(()=>hybridPlan({...data,overrides:{near:10000,far:10000,safety:30000}})).toThrow(/exceed/);
});
it("uses current equity value without adding projected growth under the availability assumption",()=>{
 const data=input(20000);data.investments=[{...cash(20000),kind:"mutual_fund",category:"equity_index",returnPct:12}];
 expect(hybridPlan(data).goals.find(g=>g.goalId==="safety")!.assumptions.runway!.accessibleCorpus).toBe(20000);
});
it("leaves expired deadlines and fully funded goals safe without adding fictitious contributions",()=>{
 const data=input(120000,50000);data.goals.push({...near,id:"past",targetDate:"2025-01-01"});
 const r=hybridPlan(data);expect(amount(r,"safety")).toBe(0);expect(amount(r,"past")).toBe(0);expect(r.immediateFundingShortfall).toBeGreaterThan(0);
});
it("uses at most two suitable retirement funds and keeps safety/lifestyle separate",()=>{
 const data=input(0,46000);data.investments.push(...funds);data.links.push(...links);const result=hybridPlan(data);const vehicles=hybridVehicles(data,result);
 expect(vehicles.filter(v=>v.parts.some(p=>p.goalId==="far"))).toHaveLength(2);
 const safetyId=vehicles.find(v=>v.parts.some(p=>p.goalId==="safety"))!.key;
 expect(vehicles.filter(v=>v.parts.some(p=>p.goalId==="near")).every(v=>v.key!==safetyId)).toBe(true);
 expect(vehicles.reduce((s,v)=>s+v.total,0)).toBe(result.totalMonthlyAllocated);
});

it("records the same funding order for the saved goal summary",()=>{
 const r=hybridPlan(input());expect(r.fundingOrder).toEqual(["safety","near","far"]);expect(r.allocationMode).toBe("safety_deadline");
});
it("still prioritizes emergency requirements when optional monthly costs are omitted",()=>{
 const data=input(0,5000);delete data.monthlyEssentials;const r=hybridPlan(data);expect(amount(r,"safety")).toBe(5000);expect(amount(r,"near")).toBe(0);
});
