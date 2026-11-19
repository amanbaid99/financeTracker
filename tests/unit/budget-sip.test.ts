import { expect,it } from "vitest";
import { budgetSipHref,parseSipMonthly } from "@/lib/budget-sip";
it("prefills a positive monthly budget without accepting invalid inputs",()=>{
 expect(budgetSipHref(32000)).toBe("/goals/sip?monthly=32000");expect(parseSipMonthly("32000")).toBe(32000);
 for(const value of [undefined,"-1","1.5","Infinity","abc","1000000001","0"])expect(parseSipMonthly(value)).toBeNull();
 for(const value of [-1,0,1.5,Infinity,1e9+1])expect(budgetSipHref(value)).toBeNull();
});
