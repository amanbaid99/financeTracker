import { z } from "zod";
import { SPEND_CATEGORY_KEYS, type SpendCategory } from "./card-advisor";
import { periodBounds, type Card } from "./cards";

const text = z.string().trim().max(1200);
export const benefitPeriod = z.enum([
  "month",
  "quarter",
  "calendar_year",
  "card_year",
]);
export const rewardRuleSchema = z.object({
  id: z.string().min(1).max(80),
  category: z.enum([...SPEND_CATEGORY_KEYS, "general"]),
  // Only explicitly stated cashback rates are comparable. Points stay in details.
  cashbackBps: z.number().int().min(1).max(10000),
  excludedCategories: z.array(z.enum(SPEND_CATEGORY_KEYS)).max(8).optional(),
  cap: z.number().int().min(0).max(1e9).nullable(),
  conditions: text,
  evidence: text.min(1),
});
export const loungeRuleSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(100),
  visits: z.number().int().min(1).max(999),
  period: benefitPeriod,
  conditions: text,
  evidence: text.min(1),
});
export const benefitDraftSchema = z
  .object({
    source: z.string().trim().min(1).max(200),
    validThrough: z.string().date().nullable(),
    details: z.string().trim().max(16000),
    rewardRules: z.array(rewardRuleSchema).max(16),
    lounges: z.array(loungeRuleSchema).max(8),
  })
  .superRefine((v, ctx) => {
    for (const key of ["rewardRules", "lounges"] as const)
      if (new Set(v[key].map((r) => r.id)).size !== v[key].length)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Use unique benefit IDs",
        });
  });
export type BenefitDraft = z.infer<typeof benefitDraftSchema>;
export type RewardRule = z.infer<typeof rewardRuleSchema>;
export type LoungeRule = z.infer<typeof loungeRuleSchema>;
export type CardBenefits = BenefitDraft & { reviewedAt: string; version: 1 };
export interface LoungeVisit {
  id: string;
  ruleId: string;
  date: string;
  visits: number;
}
export const emptyBenefits = (): BenefitDraft => ({
  source: "Card brochure",
  validThrough: null,
  details: "",
  rewardRules: [],
  lounges: [],
});
export function readCardBenefits(raw: unknown): CardBenefits | null {
  const parsed = benefitDraftSchema.safeParse(raw);
  const r = raw as Partial<CardBenefits> | null;
  return parsed.success &&
    r?.version === 1 &&
    typeof r.reviewedAt === "string" &&
    !Number.isNaN(Date.parse(r.reviewedAt))
    ? { ...parsed.data, version: 1, reviewedAt: r.reviewedAt }
    : null;
}
export function benefitsCurrent(b: CardBenefits, today: string) {
  return !b.validThrough || b.validThrough >= today;
}
/** No reward-usage ledger exists. These are published, conditional rates, not guaranteed earnings. */
export function compareCardRewards(
  cards: Card[],
  category: SpendCategory,
  amount: number,
  today: string,
) {
  return cards
    .flatMap((card) => {
      const b = card.featureDetails;
      if (!b || !benefitsCurrent(b, today)) return [];
      const rules = b.rewardRules.filter(
        (r) =>
          (r.category === category || r.category === "general") &&
          !r.excludedCategories?.includes(category),
      );
      // Category rules replace the general rate, they are not added to it.
      const applicable = rules.some((r) => r.category === category)
        ? rules.filter((r) => r.category === category)
        : rules;
      return applicable.map((rule) => ({
        cardId: card.id,
        label: card.label,
        rule,
        upperReward: Math.min(
          Number(
            (BigInt(
              Math.floor(
                Number.isFinite(amount)
                  ? Math.max(0, Math.min(amount, 1e13))
                  : 0,
              ),
            ) *
              BigInt(rule.cashbackBps)) /
              BigInt(10000),
          ),
          rule.cap ?? Infinity,
        ),
      }));
    })
    .sort(
      (a, b) =>
        b.upperReward - a.upperReward ||
        b.rule.cashbackBps - a.rule.cashbackBps ||
        a.cardId.localeCompare(b.cardId) ||
        a.rule.id.localeCompare(b.rule.id),
    );
}
export function loungeAllowance(card: Card, rule: LoungeRule, today: string) {
  if (rule.period === "card_year" && !card.yearStart)
    return { used: 0, remaining: null, start: null, end: null };
  const { start, end } = periodBounds(rule.period, today, card.yearStart, null);
  const used = (card.loungeVisits ?? [])
    .filter(
      (v) =>
        v.ruleId === rule.id &&
        v.date >= start! &&
        v.date <= end! &&
        v.date <= today,
    )
    .reduce((s, v) => s + v.visits, 0);
  return { used, remaining: Math.max(0, rule.visits - used), start, end };
}

/** Brochure rereads keep logs attached to the same allowance, never to a new pool with a reused AI ID. */
export function preserveLoungeIds(
  draft: BenefitDraft,
  previous: CardBenefits | null | undefined,
  newId: () => string,
): BenefitDraft {
  const used = new Set<string>();
  const normal = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return {
    ...draft,
    lounges: draft.lounges.map((rule) => {
      const match = previous?.lounges.find(
        (old) =>
          !used.has(old.id) &&
          normal(old.name) === normal(rule.name) &&
          old.period === rule.period,
      );
      if (match) used.add(match.id);
      return { ...rule, id: match?.id ?? newId() };
    }),
  };
}
