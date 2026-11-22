import {describe,it,expect} from "vitest";
import {heldSipHoldings,minimumReservations,minimumsFit,planWithMinimums,readSipMinimums} from "@/lib/sip-minimums";
import {monthlyVehicles} from "@/lib/investment-plan";
import {trackGoal,type Investment} from "@/lib/tracker";
import {sipPlan,planSteps} from "@/lib/sip-plan";
import {planMoney} from "@/lib/allocate";
const today="2026-11-22";
const inv=(id:string,kind="mutual_fund",category="liquid_fund",sip=0):Investment=>({id,kind,category,name:`My ${id}`,value:10000,monthlySip:sip,returnPct:0});
describe("named holding minimums",()=>{
 it("lists individual holdings even within one type",()=>{expect(heldSipHoldings([inv("first"),inv("second")]).map(x=>x.label)).toEqual(["My first","My second"]);});
 it("counts only that holding's current SIP toward its minimum",()=>{const holdings=[inv("first",undefined,undefined,1000),inv("second")];const m={"inv:first":500,"inv:second":2000};expect(minimumReservations(m,holdings).map(r=>r.extra)).toEqual([0,2000]);expect(minimumsFit(2999,m,holdings)).toBe(false);expect(minimumsFit(3000,m,holdings)).toBe(true);});
 it("preserves legacy totals without double reserving new choices",()=>{expect(minimumReservations({mutual_fund:5000,"inv:first":2000},[inv("first")]).reduce((s,r)=>s+r.extra,0)).toBe(5000);expect(readSipMinimums({"inv:first":500})).toEqual({"inv:first":500});expect(readSipMinimums({"inv:first":-1})).toEqual({});});
 it("conserves the budget with a named minimum and a goal recommendation",()=>{const investments=[inv("first"),inv("second")],goals=[trackGoal({id:"travel",name:"Travel",type:"travel",target:50000,targetDate:"2027-06-01",inflationPct:0},investments,[],today)];const p=planWithMinimums({goals,investments,links:[],monthlyTotal:10000,lump:0,todayISO:today},{"inv:second":500});const rows=monthlyVehicles(p,investments,[],goals);expect(rows.find(r=>r.key==="inv:second")?.total).toBeGreaterThanOrEqual(500);expect(rows.reduce((s,r)=>s+r.total,0)+p.leftoverMonthly).toBe(10000);});
});
describe("separate essential holdings",()=>{
 const investments=[inv("protected"),inv("bank","savings","savings_account"),inv("alternative")];
 const goals=[{id:"emergency",name:"Emergency",type:"emergency_fund",target:100000,targetDate:null,inflationPct:0},{id:"travel",name:"Travel",type:"travel",target:50000,targetDate:"2027-06-01",inflationPct:0}].map(g=>trackGoal(g,investments,[],today));
 const links=[{goalId:"emergency",investmentId:"protected",percent:100}];
 const plan=planMoney({goals,investments,links,monthlyTotal:20000,lump:1000,todayISO:today});
 it("uses an available bank for Travel and keeps essentials separate",()=>{const lines=sipPlan(plan.suggestions,investments,links,"pooled",goals);const travel=lines.find(l=>l.parts.some(p=>p.goalId==="travel"));expect(travel?.investment?.id).toBe("bank");expect(lines.find(l=>l.parts.some(p=>p.goalId==="emergency"))?.investment?.id).not.toBe("bank");});
 it("uses another liquid fund when there is no bank",()=>{const held=investments.filter(i=>i.id!=="bank");const lines=sipPlan(plan.suggestions,held,links,"pooled",goals);expect(lines.find(l=>l.parts.some(p=>p.goalId==="travel"))?.investment?.id).toBe("alternative");});
 it("keeps new essential and lifestyle placeholders separate",()=>{const lines=sipPlan(plan.suggestions,[],[],"pooled",goals);expect(new Set(lines.map(l=>l.key)).size).toBe(lines.length);expect(lines.every(l=>l.parts.length===1)).toBe(true);const steps=planSteps(plan.suggestions,[],[],"pooled",goals);expect(new Set(steps.map(s=>s.key)).size).toBe(steps.length);});
 it("never falls back to a fully reserved essentials fund",()=>{const lines=sipPlan(plan.suggestions,[investments[0]],links,"pooled",goals);expect(lines.find(l=>l.parts.some(p=>p.goalId==="travel"))?.investment).toBeNull();});
});
