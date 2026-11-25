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
export const rewardRuleSchema = z
  .object({
    id: z.string().min(1).max(80),
    category: z.enum([...SPEND_CATEGORY_KEYS, "general"]),
    // Only explicitly stated cashback rates are comparable. Points stay in details.
    cashbackBps: z.number().int().min(0).max(10000),
    points: z
      .object({
        perSpend: z.number().int().min(1).max(100000),
        spend: z.number().int().min(1).max(1000000),
        valuePaise: z.number().int().min(1).max(1000000).nullable(),
        cap: z.number().int().min(0).max(1e9).nullable(),
        redemption: z.string().trim().max(200),
      })
      .optional(),
    capPeriod: benefitPeriod.optional(),
    excludedCategories: z.array(z.enum(SPEND_CATEGORY_KEYS)).max(8).optional(),
    cap: z.number().int().min(0).max(1e9).nullable(),
    conditions: text,
    evidence: text.min(1),
  })
  .refine((r) => !!r.points || r.cashbackBps > 0, {
    message: "Enter a cashback rate or points earning rule",
  })
  .refine(
    (r) =>
      !r.points || r.points.valuePaise === null || !!r.points.redemption.trim(),
    {
      message:
        "Name the redemption this point value applies to, or leave the value blank.",
    },
  );
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
/** Exact paise internally, so small rewards still rank correctly. */
export function rewardPaiseForSpend(
  rule: RewardRule,
  amount: number,
): bigint | null {
  const spend = BigInt(
    Math.floor(
      Number.isFinite(amount) ? Math.max(0, Math.min(amount, 1e13)) : 0,
    ),
  );
  let value: bigint;
  if (rule.points) {
    const p = rule.points;
    if (p.valuePaise === null || !p.redemption.trim()) return null;
    let earned = (spend / BigInt(p.spend)) * BigInt(p.perSpend);
    if (p.cap !== null && earned > BigInt(p.cap)) earned = BigInt(p.cap);
    value = earned * BigInt(p.valuePaise);
  } else value = (spend * BigInt(rule.cashbackBps)) / BigInt(100);
  if (rule.cap !== null && value > BigInt(rule.cap) * BigInt(100))
    value = BigInt(rule.cap) * BigInt(100);
  return value;
}
/** Whole rupees for the existing app display, never rounded above the estimate. */
export function rewardForSpend(
  rule: RewardRule,
  amount: number,
): number | null {
  const value = rewardPaiseForSpend(rule, amount);
  if (value === null) return null;
  const n = Number(value / BigInt(100));
  return Number.isSafeInteger(n) ? n : null;
}
export function rewardLabel(rule: RewardRule): string {
  return rule.points
    ? `${rule.points.perSpend} points per ₹${rule.points.spend}`
    : `${rule.cashbackBps / 100}% cashback`;
}
export function rewardValueLabel(rule: RewardRule): string {
  return rule.points
    ? rule.points.valuePaise === null
      ? "Point value not set"
      : `1 point = ₹${(rule.points.valuePaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}${rule.points.redemption ? ` for ${rule.points.redemption}` : ""}`
    : "Cashback";
}
/** These payment types need explicit eligibility; a retail base rate is insufficient. */
export const EXPLICIT_REWARD_CATEGORIES: SpendCategory[] = [
  "fuel",
  "bills",
  "upi",
  "international",
];
/** Conditional published rewards. Cap usage and merchant eligibility are not inferred. */
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
          (r.category === category ||
            (r.category === "general" &&
              !EXPLICIT_REWARD_CATEGORIES.includes(category))) &&
          !r.excludedCategories?.includes(category),
      );
      const applicable = rules.some((r) => r.category === category)
        ? rules.filter((r) => r.category === category)
        : rules;
      return applicable.flatMap((rule) => {
        const upperReward = rewardForSpend(rule, amount);
        return upperReward === null
          ? []
          : [
              {
                cardId: card.id,
                label: card.label,
                rule,
                upperReward,
                rewardPaise: rewardPaiseForSpend(rule, amount)!,
              },
            ];
      });
    })
    .sort(
      (a, b) =>
        (a.rewardPaise > b.rewardPaise
          ? -1
          : a.rewardPaise < b.rewardPaise
            ? 1
            : 0) ||
        b.rule.cashbackBps - a.rule.cashbackBps ||
        a.cardId.localeCompare(b.cardId) ||
        a.rule.id.localeCompare(b.rule.id),
    );
}
export function bestCardPerCategory(
  cards: Card[],
  amount: number,
  today: string,
) {
  return SPEND_CATEGORY_KEYS.map((category) => ({
    category,
    best: compareCardRewards(cards, category, amount, today)[0] ?? null,
  }));
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
