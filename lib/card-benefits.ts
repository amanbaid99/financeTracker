import { z } from "zod";
import { SPEND_CATEGORY_KEYS, type SpendCategory } from "./card-advisor";
import { periodBounds, type Card } from "./cards";

export const PAYMENT_CHANNELS = {
  online: "Online",
  offline: "In store",
  phonepe: "PhonePe in-app",
  amazon_pay: "Amazon Pay (eligible partner)",
  upi: "UPI / Scan & Pay",
} as const;
export type SpendContext = {
  merchant?: string;
  channel?: keyof typeof PAYMENT_CHANNELS;
};
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
    channel: z
      .enum(["online", "offline", "phonepe", "amazon_pay", "upi"])
      .optional(),
    merchants: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    eligibleCategories: z.array(z.enum(SPEND_CATEGORY_KEYS)).max(20).optional(),
    capGroup: z.string().trim().max(80).optional(),
    excludedCategories: z.array(z.enum(SPEND_CATEGORY_KEYS)).max(20).optional(),
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
  conditional: z.boolean().optional(),
  annualLimit: z
    .object({
      visits: z.number().int().min(1).max(999),
      period: z.enum(["calendar_year", "card_year", "unknown"]),
    })
    .optional(),
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
  "insurance",
  "gift_cards",
  "rent",
  "gold",
  "wallet",
  "emi",
];
/** Specific merchant/app rules replace the base rate; they never stack or fall back after a cap. */
export function applicableRewardRules(
  rules: RewardRule[],
  category: SpendCategory,
  context: SpendContext = {},
) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const candidates = rules.filter((r) => {
    if (r.excludedCategories?.includes(category)) return false;
    if (
      r.eligibleCategories?.length &&
      !r.eligibleCategories.includes(category)
    )
      return false;
    if (
      r.category !== category &&
      !(
        r.category === "general" &&
        (!EXPLICIT_REWARD_CATEGORIES.includes(category) ||
          r.eligibleCategories?.includes(category))
      )
    )
      return false;
    if (
      r.channel &&
      !(
        r.channel === context.channel ||
        (r.channel === "online" &&
          ["online", "phonepe", "amazon_pay"].includes(context.channel ?? ""))
      )
    )
      return false;
    if (
      r.merchants?.length &&
      (!context.merchant ||
        !r.merchants.some((m) => norm(m) === norm(context.merchant!)))
    )
      return false;
    return true;
  });
  const score = (r: RewardRule) =>
    (r.merchants?.length ? 10000 : 0) +
    (r.channel ? (r.channel === "online" ? 500 : 1000) : 0) +
    (r.category !== "general"
      ? 200
      : r.eligibleCategories?.length
        ? 100 - r.eligibleCategories.length
        : 0);
  const highest = Math.max(-1, ...candidates.map(score));
  return candidates.filter((r) => score(r) === highest);
}
export function compareCardRewards(
  cards: Card[],
  category: SpendCategory,
  amount: number,
  today: string,
  context: SpendContext = {},
) {
  return cards
    .flatMap((card) => {
      const b = card.featureDetails;
      if (!b || !benefitsCurrent(b, today)) return [];
      return applicableRewardRules(b.rewardRules, category, context).flatMap(
        (rule) => {
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
        },
      );
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
  context: SpendContext = {},
) {
  return SPEND_CATEGORY_KEYS.map((category) => ({
    category,
    best:
      compareCardRewards(cards, category, amount, today, context)[0] ?? null,
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
  const remaining = Math.max(0, rule.visits - used);
  if (rule.conditional)
    return {
      used,
      remaining: null,
      start,
      end,
      conditional: true,
      periodRemaining: remaining,
    };
  if (rule.annualLimit) {
    if (
      rule.annualLimit.period === "unknown" ||
      (rule.annualLimit.period === "card_year" && !card.yearStart)
    )
      return {
        used,
        remaining: remaining === 0 ? 0 : null,
        start,
        end,
        annualUnverified: true,
        periodRemaining: remaining,
      };
    const bounds = periodBounds(
      rule.annualLimit.period,
      today,
      card.yearStart,
      null,
    );
    const annualUsed = (card.loungeVisits ?? [])
      .filter(
        (v) =>
          v.ruleId === rule.id &&
          v.date >= bounds.start! &&
          v.date <= bounds.end! &&
          v.date <= today,
      )
      .reduce((s, v) => s + v.visits, 0);
    return {
      used,
      remaining: Math.min(
        remaining,
        Math.max(0, rule.annualLimit.visits - annualUsed),
      ),
      start,
      end,
      annualUsed,
    };
  }
  return { used, remaining, start, end };
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
