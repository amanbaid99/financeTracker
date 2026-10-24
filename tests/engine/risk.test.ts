import { describe, expect, it } from "vitest";
import { riskFromAnswers } from "@/lib/engine/risk";

describe("risk profile", () => {
  it("maps scores to profiles", () => {
    expect(riskFromAnswers([0, 0, 1])).toBe("conservative");
    expect(riskFromAnswers([1, 1, 1])).toBe("moderate");
    expect(riskFromAnswers([2, 2, 1])).toBe("aggressive");
  });
});
