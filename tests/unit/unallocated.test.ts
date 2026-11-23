import {expect,it} from "vitest";
import {assignmentRows,unallocatedHoldings} from "@/lib/unallocated";
import type {Investment} from "@/lib/tracker";
const i:Investment={id:"bank",kind:"savings",name:"Savings account",category:"savings_account",value:100000,monthlySip:0,returnPct:0};
it("names the free part of a partially assigned holding without calling it cash",()=>{
 expect(unallocatedHoldings([i],[{goalId:"essential",investmentId:i.id,percent:90}])[0]).toMatchObject({investment:i,value:10000,freePercent:10});
 expect(unallocatedHoldings([i],[{goalId:"essential",investmentId:i.id,percent:100}])).toEqual([]);
});
it("assigns only unused ownership and preserves the goal's other holdings",()=>{
 const links=[{goalId:"essential",investmentId:i.id,percent:70},{goalId:"travel",investmentId:i.id,percent:10},{goalId:"travel",investmentId:"fund",percent:25}];
 const result=assignmentRows(links,"travel",i,15000);
 expect(result.rows).toEqual([{investmentId:"fund",percent:25},{investmentId:i.id,percent:25}]);
 expect(result.assigned).toBe(15000);expect(links[0].percent).toBe(70);
 expect(()=>assignmentRows(links,"travel",i,20001)).toThrow();
});
it("rounds shares down without exceeding available money",()=>{
 const fund={...i,value:123456};const result=assignmentRows([],"goal",fund,10000);
 expect(result.assigned).toBeLessThanOrEqual(10000);expect(result.rows[0].percent).toBe(8.1);
 expect(()=>assignmentRows([],"goal",{...i,value:100000000},1)).toThrow();
});
