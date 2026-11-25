import {expect,it} from "vitest";
import {goalRequiredSip} from "@/lib/goal-required-sip";
import type {TrackedGoal} from "@/lib/tracker";
const goal={futureTarget:120000,current:0,returnPct:0,months:12,monthlySip:15000,extraSipNeeded:0} as TrackedGoal;
it("shows total required funding rather than an existing overlarge SIP",()=>{expect(goalRequiredSip(goal)).toBe(10000);});
it("counts existing corpus and uses recurring bill requirements",()=>{expect(goalRequiredSip({...goal,current:60000})).toBe(5000);expect(goalRequiredSip({...goal,billsFund:{monthlyNeed:1234.5} as TrackedGoal["billsFund"]})).toBe(1235);});
it("omits estimates without a viable deadline and handles funded goals",()=>{expect(goalRequiredSip({...goal,months:null})).toBeNull();expect(goalRequiredSip({...goal,months:0})).toBeNull();expect(goalRequiredSip({...goal,current:120000})).toBe(0);});
