import { describe, expect, it } from "vitest";
import { pickFund, splitForGoal } from "@/lib/sip-plan";
import type { Investment, Link } from "@/lib/tracker";

const inv = (
  id: string,
  kind: string,
  category: string | null,
): Investment => ({
  id,
  kind,
  name: id,
  category,
  value: 100000,
  monthlySip: 0,
  returnPct: null,
});

describe("reusing what you hold", () => {
  const bank = inv("bank", "savings", "savings_account");
  const liquid = inv("liquid", "mutual_fund", "liquid_fund");

  it("uses a bank account partly used by another goal instead of a new fund", () => {
    const links: Link[] = [
      { goalId: "emergency", investmentId: "bank", percent: 60 },
    ];
    expect(
      pickFund("travel", "liquid_fund", [bank], links)?.investment.id,
    ).toBe("bank");
    expect(
      splitForGoal("travel", "liquid_fund", 5000, 0, [bank], links)[0]
        .investment.id,
    ).toBe("bank");
  });

  it("asks for a new fund only when everything suitable is fully used", () => {
    const links: Link[] = [
      { goalId: "emergency", investmentId: "bank", percent: 100 },
      { goalId: "emergency", investmentId: "liquid", percent: 100 },
    ];
    expect(pickFund("travel", "liquid_fund", [bank, liquid], links)).toBeNull();
    expect(
      splitForGoal("travel", "liquid_fund", 5000, 0, [bank, liquid], links),
    ).toEqual([]);
  });

  it("prefers a liquid fund over a bank account when both have room", () => {
    const links: Link[] = [
      { goalId: "emergency", investmentId: "liquid", percent: 50 },
    ];
    expect(
      pickFund("travel", "liquid_fund", [bank, liquid], links)?.investment.id,
    ).toBe("liquid");
  });
});
