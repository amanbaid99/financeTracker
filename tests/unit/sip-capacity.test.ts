import {it,expect} from "vitest";
import {sipCapacity} from "@/lib/sip-capacity";
it("missing budget and known zero savings are different states",()=>{
 expect(sipCapacity(false,0,1000,50000)).toEqual({availableSavings:50000,budgetDeficit:0,source:"manual"});
 expect(sipCapacity(true,0,1000,50000)).toEqual({availableSavings:0,budgetDeficit:1000,source:"budget"});
});
it("confirmed manual assumptions survive reload without creating income",()=>{
 expect(sipCapacity(false,0,0,50000).availableSavings).toBe(50000);
 for(const invalid of [undefined,NaN,-1,1.5,1e10,"50000"])expect(sipCapacity(false,0,0,invalid).availableSavings).toBe(0);
});
