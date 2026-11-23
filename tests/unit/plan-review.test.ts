import {it,expect} from "vitest";
import {planNeedsReview} from "@/lib/plan-review";
import {HYBRID_VERSION,calculateHybrid} from "@/lib/hybrid-engine";
it("an old confirmed calculation remains valid while material inputs stay the same",()=>{
 const saved={input_revision:"same",engine_version:HYBRID_VERSION,result:calculateHybrid({today:"2025-01-01",goals:[],investments:[],links:[],monthlySavings:0})};
 expect(planNeedsReview(saved,"same",[])).toBe(false);
 expect(planNeedsReview(saved,"changed",[])).toBe(true);
 expect(planNeedsReview({...saved,engine_version:"older"},"same",[])).toBe(true);
 expect(planNeedsReview(saved,"same",[{goalId:"goal",investmentId:"holding",percent:10}])).toBe(true);
});
