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
    expect(hints[1].title).toBe("₹9,00,000 not assigned to goals");
  });
});

it("reviews extra bank accounts without assuming a low balance means unused",()=>{const accounts=[1,2,3].map(n=>({...fund(`account${n}`,"savings_account",n===3?0:10000),kind:"savings"}));const hints=simplifyHints(accounts,{spare:{},spareTotal:0});expect(hints[0].id).toBe("bank-accounts");expect(hints[0].text).toContain("salary credits, EMIs, UPI");expect(hints[0].text).toContain("A low balance alone does not mean an account is unused");});
it("shows at most three focused simplification ideas",()=>{const many=["liquid_fund","equity_index","large_cap","flexi_cap"].flatMap(cat=>[1,2,3].map(n=>fund(`${cat}${n}`,cat,100000)));expect(simplifyHints(many,{spare:{cash:100000},spareTotal:100000})).toHaveLength(3);});
