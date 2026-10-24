import { describe, expect, it } from "vitest";
import { mergeOverrides } from "@/lib/overrides";

describe("settings overrides merge", () => {
  it("keeps values from other screens when saving one section", () => {
    const current = { ladder: { termCoverTarget: 20_000_000 }, budget: { savingsMinPct: 0.3 } };
    const next = mergeOverrides(current, { budget: { essentialsPlusSavingsCapPct: 0.85 } });
    expect(next).toEqual({
      ladder: { termCoverTarget: 20_000_000 },
      budget: { savingsMinPct: 0.3, essentialsPlusSavingsCapPct: 0.85 },
    });
  });

  it("null resets a value to the default and drops empty sections", () => {
    const next = mergeOverrides({ ladder: { termCoverTarget: 20_000_000 } }, { ladder: { termCoverTarget: null } });
    expect(next).toEqual({});
  });

  it("replaces split objects whole", () => {
    const next = mergeOverrides(
      { budget: { variableSurplus: { ladder: 0.5, goals: 0.3, wants: 0.2 } } },
      { budget: { variableSurplus: { ladder: 0.4, goals: 0.4, wants: 0.2 } } },
    );
    expect(next).toEqual({ budget: { variableSurplus: { ladder: 0.4, goals: 0.4, wants: 0.2 } } });
  });
});
