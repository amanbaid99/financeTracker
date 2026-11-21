import { describe, expect, it } from "vitest";
import { simplifyHints } from "@/lib/simplify";
import type { Investment } from "@/lib/tracker";

const fund = (
  id: string,
  category: string,
  value: number,
  monthlySip = 0,
): Investment => ({
  id,
  kind: "mutual_fund",
  name: `My ${id}`,
  category,
  value,
  monthlySip,
  returnPct: null,
});

describe("simplifyHints", () => {
  it("suggests merging funds that do the same job, keeping the biggest", () => {
    const hints = simplifyHints(
      [fund("a", "liquid_fund", 300000), fund("b", "liquid_fund", 40000)],
      { spare: {}, spareTotal: 0 },
    );
    expect(hints[0].text).toBe(
      "They do the same job. You could move My b (₹40,000) into My a.",
    );
  });

  it("flags tiny holdings and spare money", () => {
    const hints = simplifyHints(
      [
        fund("big", "flexi_cap", 5000000),
        fund("t1", "mid_small_cap", 5000),
        fund("t2", "large_cap", 8000),
      ],
      { spare: { equity: 900000 }, spareTotal: 900000 },
    );
    expect(hints.map((h) => h.id)).toEqual(["tiny", "spare"]);
    expect(hints[1].title).toBe("₹9,00,000 not needed by any goal");
  });
});
