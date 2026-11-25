import { describe, expect, it } from "vitest";
import {
  benefitDraftSchema,
  compareCardRewards,
  emptyBenefits,
  loungeAllowance,
  readCardBenefits,
  preserveLoungeIds,
  type CardBenefits,
  type LoungeRule,
} from "@/lib/card-benefits";
import { combine, parseExtraction } from "@/lib/card-extract";
import { buildAskContext, codeAskText, restoreNames } from "@/lib/ask/context";
import type { Card } from "@/lib/cards";
const today = "2026-11-25";
const reward = {
  id: "r",
  category: "online" as const,
  cashbackBps: 500,
  cap: 100,
  conditions: "Selected merchants only; monthly cap",
  evidence: "5% online cashback, capped at ₹100 per month",
};
const lounge: LoungeRule = {
  id: "l",
  name: "Domestic",
  visits: 2,
  period: "quarter",
  conditions: "Spend ₹20,000 last quarter",
  evidence: "2 domestic visits per calendar quarter",
};
const details: CardBenefits = {
  ...emptyBenefits(),
  rewardRules: [reward],
  lounges: [lounge],
  version: 1,
  reviewedAt: "2026-11-25T00:00:00Z",
};
const card = (
  id = "a",
  featureDetails: CardBenefits | null = details,
): Card => ({
  id,
  label: `Card ${id}`,
  annualFee: 500,
  yearStart: "2026-05-01",
  rewards: null,
  benefits: [],
  bestFor: [],
  milestones: [],
  bills: [],
  featureDetails,
});
describe("verified card rules", () => {
  it("never promotes unreviewed or expired terms", () => {
    expect(readCardBenefits({ ...details, reviewedAt: undefined })).toBeNull();
    expect(readCardBenefits({ ...details, version: 2 })).toBeNull();
    expect(
      compareCardRewards(
        [
          card("a", null),
          card("b", { ...details, validThrough: "2026-11-24" }),
        ],
        "online",
        1000,
        today,
      ),
    ).toEqual([]);
    expect(
      compareCardRewards(
        [card("a", { ...details, validThrough: today })],
        "online",
        1000,
        today,
      ),
    ).toHaveLength(1);
  });
  it("uses exact integer arithmetic, floors rewards and applies the published cap", () => {
    expect(
      compareCardRewards([card()], "online", 1999, today)[0].upperReward,
    ).toBe(99);
    expect(
      compareCardRewards([card()], "online", 10000, today)[0].upperReward,
    ).toBe(100);
    expect(
      compareCardRewards([card()], "online", -100, today)[0].upperReward,
    ).toBe(0);
    expect(
      compareCardRewards([card()], "online", NaN, today)[0].upperReward,
    ).toBe(0);
  });
  it("does not stack general and specific rates or invent a points value", () => {
    const c = card("a", {
      ...details,
      rewardRules: [
        {
          ...reward,
          id: "base",
          category: "general",
          cashbackBps: 1000,
          cap: null,
        },
        reward,
      ],
    });
    expect(
      compareCardRewards([c], "online", 1000, today).map((r) => r.upperReward),
    ).toEqual([50]);
    expect(compareCardRewards([c], "dining", 1000, today)[0].upperReward).toBe(
      100,
    );
    expect(
      compareCardRewards(
        [
          card("p", {
            ...details,
            rewardRules: [],
            details: "4 reward points per ₹100",
          }),
        ],
        "online",
        1000,
        today,
      ),
    ).toEqual([]);
  });
  it("is independent of retrieval order and keeps unknown terms visible", () => {
    const a = card("a"),
      b = card("b");
    expect(compareCardRewards([b, a], "online", 1000, today)).toEqual(
      compareCardRewards([a, b], "online", 1000, today),
    );
    expect(
      compareCardRewards([a], "online", 1000, today)[0].rule.conditions,
    ).toContain("Selected merchants");
  });
  it("rejects invalid rates, duplicate benefit IDs and impossible dates", () => {
    expect(
      benefitDraftSchema.safeParse({
        ...details,
        rewardRules: [reward, reward],
      }).success,
    ).toBe(false);
    expect(
      benefitDraftSchema.safeParse({
        ...details,
        rewardRules: [{ ...reward, cashbackBps: 10001 }],
      }).success,
    ).toBe(false);
    expect(
      benefitDraftSchema.safeParse({ ...details, validThrough: "2026-02-30" })
        .success,
    ).toBe(false);
  });
  it("extracts structured drafts without marking them human reviewed", () => {
    const parsed = parseExtraction(JSON.stringify({ feature_draft: details }));
    expect(parsed?.featureDraft?.lounges[0].visits).toBe(2);
    const review = combine([parsed!, parsed!], lounge.evidence);
    expect(review.featureDraft?.rewardRules).toHaveLength(1);
    expect(readCardBenefits(review.featureDraft)).toBeNull();
    expect(parseExtraction("{}")?.featureDraft).toBeUndefined();
  });
});
describe("lounge allowances", () => {
  const c = {
    ...card(),
    loungeVisits: [
      { id: "1", ruleId: "l", date: "2026-10-01", visits: 1 },
      { id: "2", ruleId: "l", date: "2026-09-30", visits: 1 },
      { id: "3", ruleId: "other", date: today, visits: 1 },
      { id: "4", ruleId: "l", date: "2026-11-26", visits: 1 },
    ],
  };
  it("counts only the right allowance and period, excluding future visits", () => {
    expect(loungeAllowance(c, lounge, today)).toEqual({
      used: 1,
      remaining: 1,
      start: "2026-10-01",
      end: "2026-12-31",
    });
    expect(loungeAllowance(c, lounge, "2027-01-01").remaining).toBe(2);
  });
  it("supports month, calendar year and anniversary reset without guessing card year", () => {
    expect(
      loungeAllowance(c, { ...lounge, period: "month" }, today).remaining,
    ).toBe(2);
    expect(
      loungeAllowance(c, { ...lounge, period: "calendar_year" }, today)
        .remaining,
    ).toBe(0);
    expect(
      loungeAllowance(
        { ...c, yearStart: null },
        { ...lounge, period: "card_year" },
        today,
      ).remaining,
    ).toBeNull();
    expect(
      loungeAllowance(c, { ...lounge, period: "card_year" }, today).end,
    ).toBe("2027-04-30");
  });
  it("never reports a negative allowance when overused", () => {
    expect(
      loungeAllowance(
        {
          ...card(),
          loungeVisits: [{ id: "x", ruleId: "l", date: today, visits: 4 }],
        },
        lounge,
        today,
      ).remaining,
    ).toBe(0);
  });
});
it("Ask uses coded human-reviewed card terms and computed lounge counts, without private labels", () => {
  const c = card();
  c.label = "Private card label";
  c.featureDetails = {
    ...details,
    details: "Private card label gives 4 points. Email a@b.test for support.",
  };
  const ctx = buildAskContext({
    goals: [],
    investments: [],
    links: [],
    plan: null,
    todayISO: today,
    cards: [c, card("b", null)],
  });
  expect(ctx.facts).not.toContain("Private card label");
  expect(ctx.facts).not.toContain("a@b.test");
  expect(ctx.facts).toContain('"remaining":2');
  expect(ctx.facts).toContain("no current human-reviewed terms");
  expect(codeAskText("Use Private card label?", ctx.names)).toBe("Use [C1]?");
  expect(restoreNames("Use [C1]", ctx.names)).toContain("Private card label");
});

it("rereading a brochure preserves the same lounge log but cannot reuse an unrelated allowance ID", () => {
  const draft = {
    ...details,
    lounges: [{ ...lounge, id: "ai-generated", name: " DOMESTIC " }],
  };
  expect(preserveLoungeIds(draft, details, () => "fresh").lounges[0].id).toBe(
    "l",
  );
  expect(
    preserveLoungeIds(
      { ...draft, lounges: [{ ...lounge, name: "International" }] },
      details,
      () => "fresh",
    ).lounges[0].id,
  ).toBe("fresh");
});

it("does not suggest a general reward rule for an explicitly excluded category", () => {
  const c = card("a", {
    ...details,
    rewardRules: [
      { ...reward, category: "general", excludedCategories: ["fuel", "bills"] },
    ],
  });
  expect(compareCardRewards([c], "fuel", 1000, today)).toEqual([]);
  expect(compareCardRewards([c], "online", 1000, today)).toHaveLength(1);
});
