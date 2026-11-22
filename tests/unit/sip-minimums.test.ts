import { describe,it,expect } from "vitest";
import { heldSipTypes,minimumsFit,minimumReservations,planWithMinimums,readSipMinimums } from "@/lib/sip-minimums";
import { monthlyVehicles } from "@/lib/investment-plan";
import { trackGoal,type Investment } from "@/lib/tracker";
const today="2026-11-21";
const inv=(id:string,kind:string,category:string,sip=0):Investment=>({id,kind,category,name:null,value:1000,monthlySip:sip,returnPct:0});
const holdings=[inv("nps","nps","nps"),inv("stock","stock","direct_equity"),inv("fund","mutual_fund","liquid_fund")];
const goals=[trackGoal({id:"trip",name:"Trip",type:"custom",target:100000,targetDate:"2027-05-21",inflationPct:0},holdings,[],today)];
describe("monthly minimums",()=>{
 it("lists every held type once, including types without a contribution",()=>{expect(heldSipTypes([...holdings,inv("fund2","mutual_fund","equity_index")]).map(t=>t.kind)).toEqual(["mutual_fund","stock","nps"]);expect(readSipMinimums(null)).toEqual({});});
 it("reserves three 500 minimums and uses only the remainder for recommendations",()=>{const p=planWithMinimums({goals,investments:holdings,links:[],lump:0,monthlyTotal:30000,todayISO:today},{"inv:nps":500,"inv:stock":500,"inv:fund":500});expect(p.reservedMonthly).toBe(1500);expect(p.suggestions.reduce((sum,s)=>sum+s.monthly,0)+p.leftoverMonthly).toBe(28500);const rows=monthlyVehicles(p,holdings,[],goals);expect(rows.reduce((s,r)=>s+r.total,0)+p.leftoverMonthly).toBe(30000);expect(rows.find(r=>r.key==="inv:nps")?.total).toBe(500);expect(rows.find(r=>r.key==="inv:stock")?.total).toBe(500);});
 it("counts running SIPs toward a minimum without cutting or double-counting them",()=>{const investments=[inv("fund","mutual_fund","liquid_fund",1000)];expect(minimumReservations({"inv:fund":500},investments)[0].extra).toBe(0);const p=planWithMinimums({goals,investments,links:[],lump:0,monthlyTotal:30000,todayISO:today},{"inv:fund":500});const rows=monthlyVehicles(p,investments,[],goals);expect(rows.reduce((sum,r)=>sum+r.total,0)+p.leftoverMonthly).toBe(30000);expect(rows.find(r=>r.fixed)).toBeUndefined();expect(rows.reduce((sum,r)=>sum+r.current,0)).toBe(1000);});
 it("rejects over-budget and malformed minimums",()=>{expect(minimumsFit(1000,{"inv:nps":500,"inv:stock":500,"inv:fund":500},holdings)).toBe(false);expect(readSipMinimums({nps:-1})).toEqual({});expect(readSipMinimums({invented:500})).toEqual({});expect(readSipMinimums({nps:1.5})).toEqual({});});
 it("leaves input holdings untouched and preserves the one-time amount",()=>{const before=JSON.stringify(holdings);const p=planWithMinimums({goals,investments:holdings,links:[],lump:12345,monthlyTotal:30000,todayISO:today},{"inv:nps":500});expect(p.lump).toBe(12345);expect(JSON.stringify(holdings)).toBe(before);});
});
