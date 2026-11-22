import { describe, expect, it } from "vitest";
import { investmentPurpose, purposeVehicles, type MonthlyVehicle } from "@/lib/investment-plan";

describe("separate monthly purposes",()=>{
 it("separates a shared vehicle without duplicating contributions",()=>{
  const row:MonthlyVehicle={key:"inv:shared",label:"Shared fund",current:5000,extra:10000,total:15000,parts:[{goalId:"e",goalName:"Emergency",monthly:6000,until:null,purpose:"safety"},{goalId:"t",goalName:"Travel",monthly:7000,until:"2027-01-01",purpose:"lifestyle"}]};
  const before=JSON.stringify(row),groups=purposeVehicles([row]);
  expect(groups.map(g=>[g.purpose,g.total])).toEqual([["safety",6000],["lifestyle",7000],["unassigned",2000]]);
  expect(groups.reduce((sum,g)=>sum+g.total,0)).toBe(row.total);
  expect(JSON.stringify(row)).toBe(before);
 });
 it("keeps essentials protected regardless of horizon",()=>{
  for(const type of ["emergency_fund","bills_fund","loan_payoff"])expect(investmentPurpose({type,months:100})).toBe("safety");
  expect(investmentPurpose({type:"custom",months:12})).toBe("lifestyle");
  expect(investmentPurpose({type:"custom",months:60})).toBe("long_term");
 });
 it("keeps custom minimums and unmapped SIPs visible",()=>{
  expect(purposeVehicles([{key:"fixed:nps",label:"NPS",fixed:true,current:0,extra:500,total:500,parts:[]}])[0].total).toBe(500);
 });
});
