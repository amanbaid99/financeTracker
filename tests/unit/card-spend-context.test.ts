import { expect, it } from "vitest";
import {
  compareCardRewards,
  emptyBenefits,
  loungeAllowance,
  type RewardRule,
  type LoungeRule,
} from "@/lib/card-benefits";
import {
  answerCardQuestion,
  cardSpendContext,
  cardSpendCategory,
} from "@/lib/ask/cards";
import type { Card } from "@/lib/cards";
const today = "2026-11-25";
const rule = (
  id: string,
  bps: number,
  cap: number | null,
  extra: Partial<RewardRule> = {},
): RewardRule => ({
  id,
  category: "general",
  cashbackBps: bps,
  cap,
  conditions: "Eligible transactions only",
  evidence: "User-confirmed terms",
  ...extra,
});
const card = (rules: RewardRule[]): Card => ({
  id: "test",
  label: "User card",
  annualFee: 1000,
  yearStart: "2026-03-01",
  rewards: null,
  benefits: [],
  bestFor: [],
  milestones: [],
  bills: [],
  featureDetails: {
    ...emptyBenefits(),
    version: 1,
    reviewedAt: "2026-11-25T00:00:00Z",
    rewardRules: rules,
  },
});
it("keeps app-specific insurance and non-insurance caps separate without fallback or stacking", () => {
  const c = card([
    rule("other", 100, 2000, {
      eligibleCategories: ["online", "groceries", "upi"],
    }),
    rule("online", 500, 1000, {
      channel: "online",
      eligibleCategories: ["bills", "insurance", "online"],
    }),
    rule("app", 1000, 1500, {
      channel: "phonepe",
      eligibleCategories: ["bills", "travel"],
      capGroup: "app-shared",
    }),
    rule("insurance", 1000, 500, { channel: "phonepe", category: "insurance" }),
  ]);
  expect(
    compareCardRewards([c], "insurance", 20000, today, {
      channel: "phonepe",
    })[0],
  ).toMatchObject({ upperReward: 500, rule: { id: "insurance" } });
  expect(
    compareCardRewards([c], "bills", 20000, today, { channel: "phonepe" })[0]
      .upperReward,
  ).toBe(1500);
  expect(
    compareCardRewards([c], "insurance", 20000, today, { channel: "online" })[0]
      .upperReward,
  ).toBe(1000);
  expect(
    compareCardRewards([c], "upi", 10000, today, { channel: "upi" })[0]
      .upperReward,
  ).toBe(100);
});
it("partner rates require an exact merchant and the eligible payment method", () => {
  const c = card([
    rule("base", 100, 1000, {
      eligibleCategories: ["online", "dining", "upi"],
    }),
    rule("partner", 500, 1000, {
      channel: "online",
      merchants: ["Partner Store", "Partner.Store"],
      eligibleCategories: ["online", "dining"],
    }),
  ]);
  expect(
    compareCardRewards([c], "online", 10000, today, { channel: "online" })[0]
      .upperReward,
  ).toBe(100);
  expect(
    compareCardRewards([c], "online", 10000, today, {
      channel: "online",
      merchant: "Partner Store",
    })[0].upperReward,
  ).toBe(500);
  expect(
    compareCardRewards([c], "online", 10000, today, {
      channel: "online",
      merchant: "Not Partner Store",
    })[0].upperReward,
  ).toBe(100);
  expect(
    compareCardRewards([c], "upi", 10000, today, {
      channel: "upi",
      merchant: "Partner Store",
    })[0].upperReward,
  ).toBe(100);
});
it("a specific accelerated bucket remains capped even when a base estimate would be larger", () => {
  const p = {
    perSpend: 2,
    spend: 100,
    valuePaise: 180,
    cap: null,
    redemption: "Chosen hotel redemption",
  };
  const c = card([
    rule("base", 0, null, {
      points: p,
      eligibleCategories: ["online", "groceries", "dining", "travel"],
    }),
    rule("travel", 0, null, {
      points: { ...p, perSpend: 4, cap: 50000 },
      eligibleCategories: ["travel", "international"],
      capGroup: "travel-shared",
    }),
  ]);
  expect(compareCardRewards([c], "travel", 10000, today)[0].upperReward).toBe(
    720,
  );
  expect(
    compareCardRewards([c], "international", 10000, today)[0].upperReward,
  ).toBe(720);
  expect(compareCardRewards([c], "travel", 5000000, today)[0]).toMatchObject({
    upperReward: 90000,
    rule: { id: "travel" },
  });
});
it("annual limits apply across calendar quarters and unknown reset periods stay unconfirmed", () => {
  const c = card([]);
  const r: LoungeRule = {
    id: "l",
    name: "Domestic",
    visits: 1,
    period: "quarter",
    annualLimit: { visits: 4, period: "card_year" },
    conditions: "One quarterly, four annually",
    evidence: "Confirmed",
  };
  c.loungeVisits = ["2026-03-25", "2026-04-15", "2026-07-20", "2026-10-14"].map(
    (date, i) => ({ id: String(i), ruleId: "l", date, visits: 1 }),
  );
  expect(loungeAllowance(c, r, "2027-01-05").remaining).toBe(0);
  expect(
    loungeAllowance(
      c,
      { ...r, annualLimit: { visits: 4, period: "unknown" } },
      "2027-01-05",
    ),
  ).toMatchObject({
    remaining: null,
    annualUnverified: true,
    periodRemaining: 1,
  });
  expect(
    loungeAllowance(
      c,
      { ...r, annualLimit: undefined, conditional: true },
      today,
    ),
  ).toMatchObject({ remaining: null, conditional: true });
});
it("Ask recognizes insurance before generic bills and keeps a payment-app name distinct from a store", () => {
  const c = card([
    rule("app", 1000, 500, { channel: "phonepe", category: "insurance" }),
    rule("market", 500, null, {
      merchants: ["Market Store"],
      eligibleCategories: ["online"],
    }),
  ]);
  expect(cardSpendCategory("online insurance bill")).toBe("insurance");
  expect(
    cardSpendContext("Which card for ₹10,000 insurance using PhonePe?", [c]),
  ).toMatchObject({ channel: "phonepe" });
  expect(
    answerCardQuestion([c], today, [
      {
        role: "user",
        content: "Which card for ₹10,000 insurance using PhonePe?",
      },
    ])?.shown,
  ).toContain("₹500");
  expect(
    cardSpendContext("Which card for ₹5,000 at Market Store?", [c]),
  ).toMatchObject({ channel: "online", merchant: "Market Store" });
});
