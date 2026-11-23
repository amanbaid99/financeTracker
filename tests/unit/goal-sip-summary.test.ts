import {expect,it} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {GoalSipSummary} from "@/components/goal-sip-summary";
import {hybridPlan} from "@/lib/hybrid-plan";
it("renders saved goals in funding order rather than database ID order",()=>{
 const r=hybridPlan({today:"2026-11-23",goals:[{id:"a",name:"Later",type:"custom",target:120000,targetDate:"2028-11-23",inflationPct:0,expectedReturnPct:0},{id:"z",name:"Sooner",type:"custom",target:120000,targetDate:"2027-11-23",inflationPct:0,expectedReturnPct:0}],investments:[],links:[],monthlySavings:20000,allocationMode:"safety_deadline",monthlyEssentials:0});
 const html=renderToStaticMarkup(createElement(GoalSipSummary,{result:r}));expect(html.indexOf("Sooner")).toBeLessThan(html.indexOf("Later"));
});
