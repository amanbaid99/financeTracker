import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SavedSipSummary } from "@/components/saved-sip-summary";
import type { HybridResult } from "@/lib/hybrid-engine";
it("displays confirmed goal and vehicle amounts in funding order without changing the snapshot",()=>{
 const result={totalMonthlyAllocated:26000,fundingOrder:["safety","travel"],goals:[{goalId:"travel",goalName:"Travel",recommendedMonthly:1000},{goalId:"safety",goalName:"Safety",recommendedMonthly:25000}],vehicles:[{key:"held",label:"Held liquid fund",parts:[{goalId:"safety",monthly:25000}]},{key:"bank",label:"Travel account",parts:[{goalId:"travel",monthly:1000}]}]} as HybridResult;
 const before=JSON.stringify(result);const html=renderToStaticMarkup(createElement(SavedSipSummary,{result}));
 expect(html).toContain("₹26,000");expect(html).toContain("₹25,000");expect(html).toContain("Travel account");expect(html.indexOf("Safety")).toBeLessThan(html.indexOf("Travel</h3>"));expect(html).toContain('href="/goals/sip"');expect(html).toContain("Planned amounts only");expect(JSON.stringify(result)).toBe(before);
});
it("keeps a confirmed zero plan editable",()=>{
 const html=renderToStaticMarkup(createElement(SavedSipSummary,{result:{totalMonthlyAllocated:0,goals:[]} as unknown as HybridResult}));
 expect(html).toContain("₹0");expect(html).toContain("No monthly contributions");expect(html).toContain("Edit plan");
});
it("shows a review reminder without changing confirmed amounts",()=>{
 const result={totalMonthlyAllocated:71000,goals:[]} as unknown as HybridResult;
 const html=renderToStaticMarkup(createElement(SavedSipSummary,{result,startMonth:"2027-01",savedOn:"2026-11-24",today:"2027-01-01"}));
 expect(html).toContain("₹71,000");expect(html).toContain("Jan 2027");expect(html).toContain("Review plan");expect(html).toContain("saved amounts stay unchanged");
});
