import { expect, it } from "vitest";
import { cardStrategy, cardSpendGuide } from "@/lib/card-strategy";
import { emptyBenefits, readCardBenefits } from "@/lib/card-benefits";
import type { Card } from "@/lib/cards";
const card: Card = {
  id: "card",
  label: "My card",
  annualFee: null,
  yearStart: null,
  rewards: null,
  benefits: [],
  bestFor: [],
  bills: [],
  milestones: [],
};
it("does not invent strategy for names without confirmed terms", () => {
  expect(cardStrategy({ ...card, label: "SBI PhonePe" })).toEqual({
    useFor: "",
    remember: "",
  });
  expect(cardStrategy(card)).toEqual({ useFor: "", remember: "" });
});
it("retains personal edits and intentional hiding through the saved-benefit reader", () => {
  const features = readCardBenefits({
    ...emptyBenefits(),
    version: 1,
    reviewedAt: "2026-11-25T00:00:00Z",
    strategy: { useFor: "My groceries", remember: "Use my preferred card" },
  })!;
  expect(cardStrategy({ ...card, featureDetails: features })).toEqual(
    features.strategy,
  );
  features.strategy = { useFor: "", remember: "" };
  expect(cardStrategy({ ...card, featureDetails: features })).toEqual({
    useFor: "",
    remember: "",
  });
});

it("does not turn personal notes or a matching card name into unsupported spend recommendations", () => {
  const c = {
    ...card,
    label: "SBI PhonePe",
    featureDetails: {
      ...emptyBenefits(),
      version: 1 as const,
      reviewedAt: "2026-11-25T00:00:00Z",
      strategy: { useFor: "10% fuel", remember: "My note" },
    },
  };
  expect(cardSpendGuide([c])).toEqual([]);
});
it("keeps the reference intentional with Amazon under shopping and no speculative fuel category", () => {
  const c = {
    ...card,
    label: "Amazon Pay ICICI",
    featureDetails: {
      ...emptyBenefits(),
      version: 1 as const,
      reviewedAt: "2026-11-25T00:00:00Z",
      rewardRules: [
        {
          id: "amazon",
          category: "general" as const,
          cashbackBps: 500,
          cap: null,
          merchants: ["Amazon"],
          conditions: "Eligible purchases",
          evidence: "Confirmed",
        },
      ],
    },
  };
  const guide = cardSpendGuide([c]);
  expect(guide.map((g) => g.id)).toEqual(["online"]);
  expect(guide[0].rows.map((r) => [r.label, r.cardName, r.reason])).toEqual([
    ["Amazon", "Amazon Pay ICICI", "5% cashback"],
  ]);
});

it("shows HSBC redemption estimates for travel and base spends at the chosen Accor value", () => {
  const c = {
    ...card,
    label: "HSBC TravelOne",
    featureDetails: {
      ...emptyBenefits(),
      version: 1 as const,
      reviewedAt: "2026-11-25T00:00:00Z",
      rewardRules: [2, 4].map((n) => ({
        id: `hsbc-${n}`,
        category: "general" as const,
        cashbackBps: 0,
        cap: null,
        conditions: "Eligible spends",
        evidence: "Confirmed",
        points: {
          perSpend: n,
          spend: 100,
          valuePaise: 180,
          cap: n === 4 ? 50000 : null,
          redemption: "Accor hotels",
        },
      })),
    },
  };
  const guide = cardSpendGuide([c]);
  expect(guide.find((g) => g.id === "travel")?.rows[0].reason).toBe(
    "≈7.2% at Accor",
  );
  expect(guide.find((g) => g.id === "offline")?.rows[0].reason).toBe(
    "≈3.6% at Accor",
  );
  expect(guide.find((g) => g.id === "offline")?.rows[0].limit).toContain(
    "not cashback",
  );
});
it("shows UPI only from a confirmed merchant-payment bucket", () => {
  const rules = [
    {
      id: "insurance",
      category: "insurance" as const,
      channel: "phonepe" as const,
      cashbackBps: 1000,
      cap: 500,
    },
    {
      id: "online",
      category: "general" as const,
      channel: "online" as const,
      cashbackBps: 500,
      cap: 1000,
    },
    {
      id: "bills",
      category: "general" as const,
      channel: "phonepe" as const,
      cashbackBps: 1000,
      cap: 1500,
    },
    {
      id: "base",
      category: "general" as const,
      cashbackBps: 100,
      cap: 2000,
      eligibleCategories: ["upi" as const],
    },
  ].map((r) => ({
    ...r,
    capPeriod: "month" as const,
    conditions: "Eligible spends",
    evidence: "Confirmed",
  }));
  const c = {
    ...card,
    label: "SBI PhonePe",
    featureDetails: {
      ...emptyBenefits(),
      version: 1 as const,
      reviewedAt: "2026-11-25T00:00:00Z",
      rewardRules: rules,
    },
  };
  expect(cardSpendGuide([c]).find((g) => g.id === "upi")?.rows[0].reason).toBe(
    "1% back",
  );
  c.featureDetails.rewardRules = rules.filter((r) => r.id !== "base");
  expect(cardSpendGuide([c]).find((g) => g.id === "upi")).toBeUndefined();
});
