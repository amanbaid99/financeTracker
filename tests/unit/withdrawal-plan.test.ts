import { describe,it,expect } from "vitest";
import { planWithdrawal,withdrawalEligible } from "@/lib/withdrawal-plan";
import { codeAskText } from "@/lib/ask/context";
import { withdrawalAmount,withdrawalAnswer } from "@/lib/ask/withdrawal";
import { trackGoal,type Investment,type GoalInput } from "@/lib/tracker";
const today="2026-11-21";
const inv=(id:string,value:number,kind="savings",category="savings_account"):Investment=>({id,name:null,kind,category,value,monthlySip:0,returnPct:0});
const goal=(id:string,target:number,type="custom"):GoalInput=>({id,name:id,type,target,targetDate:type==="emergency_fund"?null:"2027-01-21",inflationPct:0});
const run=(inputs:GoalInput[],investments:Investment[],extra:Partial<Parameters<typeof planWithdrawal>[0]>={})=>planWithdrawal({amount:10000,goals:inputs.map(g=>trackGoal(g,investments,[],today)),investments,today,...extra});
describe("withdrawal previews",()=>{
 it("uses free accessible money without writes",()=>{const investments=[inv("cash",20000)];const copy=JSON.stringify(investments);const p=run([],investments);expect(p.available).toBe(10000);expect(p.short).toBe(0);expect(p.lines[0].remaining).toBe(10000);expect(p.impacts).toEqual([]);expect(JSON.stringify(investments)).toBe(copy);});
 it("protects assigned goals unless selected or opted in",()=>{const goals=[goal("Trip",20000)],investments=[inv("cash",20000)];expect(run(goals,investments).available).toBe(0);const selected=run(goals,investments,{goalId:"Trip"});expect(selected.available).toBe(10000);expect(selected.impacts[0].extraShortfall).toBe(10000);expect(run(goals,investments,{allowOtherGoals:true}).available).toBe(10000);});
 it("protects the emergency reserve even with other-goals permission",()=>{const goals=[goal("Emergency",20000,"emergency_fund")],investments=[inv("cash",20000)];expect(run(goals,investments,{allowOtherGoals:true}).available).toBe(0);expect(run(goals,investments,{goalId:"Emergency"}).available).toBe(10000);});
 it("excludes unverified locks and maturity-dependent assets",()=>{const holdings=[inv("locked",100000,"mutual_fund","elss"),inv("fd",100000,"fd","fd_rd"),inv("retirement",100000,"nps","nps"),inv("unknown",100000,"other","other")];expect(holdings.some(withdrawalEligible)).toBe(false);const p=run([],holdings);expect(p.short).toBe(10000);expect(p.excluded).toBe(4);});
 it("conserves every rupee without over-drawing a shared holding",()=>{const p=run([goal("Trip",40000)],[inv("cash",50000)],{amount:60000,goalId:"Trip"});expect(p.available+p.short).toBe(60000);expect(p.lines.reduce((s,l)=>s+l.amount,0)).toBe(50000);expect(p.lines.at(-1)?.remaining).toBe(0);});
 it("rejects invalid amounts and unknown goals",()=>{for(const amount of [0,-1,NaN,Infinity,1.2,1e10])expect(()=>run([],[],{amount})).toThrow();expect(()=>run([],[],{goalId:"missing"})).toThrow();});
 it("answers withdrawal questions locally using codes and exact figures",()=>{expect(withdrawalAmount("Where can ₹10,000 come from?")).toBe(10000);expect(withdrawalAmount("Where should I invest ₹10,000?")).toBe(null);expect(withdrawalAmount("Withdraw -₹10,000")).toBe(null);const answer=withdrawalAnswer({text:"Withdraw ₹10,000",amount:10000,goals:[],investments:[inv("cash",20000)],today,codeOf:{cash:"[I1]"}});expect(answer).toContain("₹10,000 from [I1]");expect(answer).toContain("Nothing is withdrawn or saved");});
 it("codes typed names and identifiers in follow-up history",()=>{const coded=codeAskText("Travel (2027) from My account. Mail person@example.com PAN ABCDE1234F phone 9876543210",{"[G1]":"Travel (2027)","[I1]":"My account"});expect(coded).toBe("[G1] from [I1]. Mail [email] PAN [PAN] phone [phone]");});
});
