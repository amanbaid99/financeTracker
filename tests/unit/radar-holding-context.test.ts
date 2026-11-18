import { describe, expect, it } from "vitest";
import { holdingContext } from "@/lib/radar/holding-context";
const isin = "INE000000001";
describe("Radar holding context", () => {
  it("combines exact-ISIN positions and includes unmatched investments in the denominator", () => {
    expect(holdingContext(isin, [{ isin, current_value: 100 }, { isin, current_value: 200 }, { isin: null, current_value: 700 }])).toEqual({ matched: true, recordedValue: 300, trackedSharePct: 30 });
  });
  it.each([null, "", "invalid", "INE000000002"])("does not infer ownership for %s", (id) => {
    expect(holdingContext(id, [{ isin, current_value: 100 }]).matched).toBe(false);
  });
  it("does not treat a zero-value record as current ownership", () => {
    expect(holdingContext(isin, [{ isin, current_value: 0 }]).matched).toBe(false);
  });
  it.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])("withholds the percentage for unreliable totals: %s", (value) => {
    const result = holdingContext(isin, [{ isin, current_value: 100 }, { isin: null, current_value: value }]);
    expect(result).toEqual({ matched: true, recordedValue: 100, trackedSharePct: null });
  });
  it("withholds an incomplete matched value and unsafe aggregate", () => {
    expect(holdingContext(isin, [{ isin, current_value: 100 }, { isin, current_value: -1 }]).recordedValue).toBeNull();
    expect(holdingContext(isin, [{ isin, current_value: Number.MAX_SAFE_INTEGER }, { isin, current_value: 1 }]).recordedValue).toBeNull();
  });
});
