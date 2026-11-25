import { describe, expect, it } from "vitest";
import {
  benefitDraftSchema,
  compareCardRewards,
  emptyBenefits,
  rewardForSpend,
  type RewardRule,
} from "@/lib/card-benefits";
import { cardSetupDraft, changedMilestones } from "@/lib/card-setup";
import {
  answerCardQuestion,
  cardSpendAmount,
  isCardBenefitQuestion,
} from "@/lib/ask/cards";
import type { Card } from "@/lib/cards";
import { combine, parseExtraction } from "@/lib/card-extract";
const day = "2026-11-25";
const points: RewardRule = {
  id: "p",
  category: "general",
  cashbackBps: 0,
  cap: null,
  points: {
    perSpend: 4,
    spend: 150,
    valuePaise: 50,
    cap: null,
    redemption: "statement credit",
  },
  conditions: "Eligible purchases only",
  evidence: "4 points per ₹150, worth ₹0.50 each for statement credit",
};
const cash: RewardRule = {
  id: "c",
  category: "groceries",
  cashbackBps: 300,
  cap: 100,
  conditions: "Supermarkets only",
  evidence: "3% on groceries, ₹100 monthly cap",
  capPeriod: "month",
};
const card = (id: string, rule: RewardRule): Card => ({
  id,
  label: `Private ${id}`,
  annualFee: 500,
  yearStart: null,
  rewards: null,
  benefits: [],
  bestFor: [],
  bills: [],
  milestones: [],
  featureDetails: {
    ...emptyBenefits(),
    rewardRules: [rule],
    version: 1,
    reviewedAt: "2026-11-25T00:00:00Z",
  },
});
const ask = (q: string, cards = [card("a", points), card("b", cash)]) =>
  answerCardQuestion(cards, day, [{ role: "user", content: q }]);
describe("guided card facts and points", () => {
  it("keeps unknowns empty and preserves existing card, lounge IDs and notes", () => {
    expect(cardSetupDraft(null, undefined, () => "new")).toMatchObject({
      label: "",
      annualFee: null,
      features: { rewardRules: [], source: "Entered by you" },
    });
    const c = card("a", points);
    c.featureDetails!.lounges = [
      {
        id: "stable",
        name: "Domestic",
        visits: 2,
        period: "quarter",
        conditions: "Spend threshold applies",
        evidence: "2 visits",
      },
    ];
    const before = JSON.stringify(c);
    const d = cardSetupDraft(c, undefined, () => "new");
    expect(d.features.lounges[0].id).toBe("stable");
    expect(d.features.rewardRules[0].points?.valuePaise).toBe(50);
    expect(JSON.stringify(c)).toBe(before);
  });
  it("does not mark an unsupported AI benefit as a confirmed fact", () => {
    const p = parseExtraction(
      JSON.stringify({
        benefits: ["Free golf every month", "2 lounge visits"],
      }),
    )!;
    const review = combine([p, p], "2 lounge visits");
    const d = cardSetupDraft(null, review, () => "n");
    expect(d.features.details).toContain("2 lounge visits");
    expect(d.features.details).not.toContain("Free golf");
  });
  it("requires a real earning rule and never guesses point conversion", () => {
    expect(
      benefitDraftSchema.safeParse({
        ...emptyBenefits(),
        rewardRules: [
          { ...points, points: { ...points.points!, perSpend: 0 } },
        ],
      }).success,
    ).toBe(false);
    const unknown = {
      ...points,
      points: { ...points.points!, valuePaise: null },
    };
    expect(rewardForSpend(unknown, 5000)).toBeNull();
    expect(
      compareCardRewards([card("a", unknown)], "groceries", 5000, day),
    ).toEqual([]);
  });
  it("calculates spend steps, points caps and cash-value caps exactly", () => {
    expect(rewardForSpend(points, 1000)).toBe(12);
    expect(rewardForSpend(points, 149)).toBe(0);
    expect(
      rewardForSpend(
        { ...points, points: { ...points.points!, cap: 10 } },
        1000,
      ),
    ).toBe(5);
    expect(rewardForSpend({ ...points, cap: 3 }, 1000)).toBe(3);
    expect(rewardForSpend(cash, 5000)).toBe(100);
  });
  it("ranks by exact paise rather than whole-rupee rounding or retrieval order", () => {
    const small = card("z", {
        ...points,
        points: { ...points.points!, perSpend: 1, spend: 100, valuePaise: 75 },
      }),
      other = card("a", {
        ...cash,
        category: "general",
        cashbackBps: 50,
        cap: null,
      });
    expect(
      compareCardRewards([other, small], "groceries", 100, day)[0].cardId,
    ).toBe("z");
    expect(compareCardRewards([small, other], "groceries", 100, day)).toEqual(
      compareCardRewards([other, small], "groceries", 100, day),
    );
  });
  it("only requests changed milestones, preserving existing records", () => {
    const c = card("a", cash);
    c.milestones = [
      {
        id: "m",
        name: "Fee waiver",
        target: 10000,
        period: "card_year",
        deadline: null,
        reward: "Fee waived",
        createdAt: day,
      },
    ];
    const d = cardSetupDraft(c, undefined, () => "n");
    expect(changedMilestones(d.milestones, c.milestones)).toEqual([]);
    expect(
      changedMilestones([{ ...d.milestones[0], target: 20000 }], c.milestones),
    ).toHaveLength(1);
  });
});
describe("card questions", () => {
  it("parses amounts and leaves debt or investing questions in their own workflow", () => {
    expect(cardSpendAmount("Which card for ₹5k on groceries?")).toBe(5000);
    expect(cardSpendAmount("₹1.5 lakh")).toBe(150000);
    expect(cardSpendAmount("5k")).toBe(5000);
    expect(cardSpendAmount("₹1.5L")).toBe(150000);
    expect(cardSpendAmount("₹1.5 LAKH")).toBe(150000);
    expect(ask("Should I prepay my loan with ₹5,000?")).toBeNull();
    expect(ask("Where should my ₹10,000 investment go?")).toBeNull();
  });
  it("answers comparisons without AI and keeps private labels out of coded answers", () => {
    const result = ask("Which card for ₹5,000 on groceries?")!;
    expect(result.coded).toContain("[C2]");
    expect(result.coded).toContain("₹100");
    expect(result.coded).not.toContain("Private");
    expect(result.shown).toContain("Private b");
    expect(result.shown).toContain("Supermarkets only");
  });
  it("asks for missing amounts and categories instead of inventing them", () => {
    expect(ask("Which card for groceries?")?.choices).toHaveLength(3);
    expect(ask("Which card for ₹5,000?")?.coded).toContain(
      "What are you spending on",
    );
  });
  it("handles an amount-only follow-up as a card question", () => {
    const history = [
      { role: "user", content: "Which card for groceries?" },
      { role: "assistant", content: "How much?" },
      { role: "user", content: "₹5,000" },
    ];
    expect(isCardBenefitQuestion(history)).toBe(true);
    expect(
      answerCardQuestion([card("a", cash)], day, history)?.shown,
    ).toContain("₹100");
  });
  it("reports fees, point values, cap periods and unknowns from saved terms", () => {
    expect(ask("What are my annual card fees?")?.shown).toContain("₹500");
    expect(ask("How do my card points and caps work?")?.shown).toContain(
      "statement credit",
    );
    expect(ask("What are my cashback caps?")?.shown).toContain("Each month");
    expect(
      ask("Which card for ₹100 on fuel?", [
        card("a", {
          ...points,
          points: { ...points.points!, valuePaise: null },
        }),
      ])?.shown,
    ).toContain("can't compare");
  });
  it("uses current terms only and keeps lounge quota distinct from access eligibility", () => {
    const c = card("a", cash);
    c.featureDetails!.lounges = [
      {
        id: "l",
        name: "Domestic",
        visits: 2,
        period: "quarter",
        conditions: "Spend ₹20,000 last quarter",
        evidence: "2 visits",
      },
    ];
    c.loungeVisits = [{ id: "v", ruleId: "l", date: day, visits: 1 }];
    const answer = ask("How many lounge visits do I have left?", [c])!.shown;
    expect(answer).toContain("1 of 2");
    expect(answer).toContain("do not confirm entry");
    c.featureDetails!.validThrough = "2026-11-24";
    expect(ask("Which card for ₹5,000 on groceries?", [c])?.shown).toContain(
      "can't compare",
    );
  });
});

it("a general retail rate never establishes eligibility for UPI, fuel, bills or international spending", () => {
  const c = card("a", points);
  for (const category of ["upi", "fuel", "bills", "international"] as const)
    expect(compareCardRewards([c], category, 1000, day)).toEqual([]);
  expect(compareCardRewards([c], "groceries", 1000, day)).toHaveLength(1);
  expect(
    compareCardRewards(
      [card("a", { ...points, category: "upi" })],
      "upi",
      1000,
      day,
    ),
  ).toHaveLength(1);
});

it("does not rank a point value without its redemption context", () => {
  const r = { ...points, points: { ...points.points!, redemption: "" } };
  expect(
    benefitDraftSchema.safeParse({ ...emptyBenefits(), rewardRules: [r] })
      .success,
  ).toBe(false);
  expect(rewardForSpend(r, 1000)).toBeNull();
});
