import type { Card } from "@/lib/cards";
import { milestoneState, PERIOD_LABELS } from "@/lib/cards";
import {
  benefitsCurrent,
  compareCardRewards,
  loungeAllowance,
  rewardLabel,
  rewardValueLabel,
  type SpendContext,
} from "@/lib/card-benefits";
import { SPEND_CATEGORIES, type SpendCategory } from "@/lib/card-advisor";
import { formatINR } from "@/lib/format";
import { restoreNames, codeAskText } from "./context";

const categories: [SpendCategory, RegExp][] = [
  ["rent", /\brent\b/i],
  ["gold", /\b(gold|jewellery|jewelry)\b/i],
  ["wallet", /\bwallet\b/i],
  ["emi", /\bemi\b/i],
  ["insurance", /\binsurance\b/i],
  ["gift_cards", /\bgift\s*cards?\b/i],
  ["international", /\b(international|overseas|forex|foreign)\b/i],
  ["groceries", /\b(grocer\w*|supermarket\w*)\b/i],
  ["dining", /\b(dining|restaurants?|food|eating out)\b/i],
  ["fuel", /\b(fuel|petrol|diesel)\b/i],
  ["bills", /\b(bills?|utilities|electricity|recharge)\b/i],
  ["upi", /\b(upi|scan.*pay)\b/i],
  ["travel", /\b(travel|flights?|hotels?|booking)\b/i],
  ["online", /\b(online|shopping)\b/i],
];
export function cardSpendContext(text: string, cards: Card[]): SpendContext {
  const context: SpendContext = {};
  context.channel = /\bupi\b|scan.*pay/i.test(text)
    ? "upi"
    : /phonepe/i.test(text)
      ? "phonepe"
      : /amazon\s*pay/i.test(text)
        ? "amazon_pay"
        : /\b(offline|in.store)\b/i.test(text)
          ? "offline"
          : /\bonline\b/i.test(text)
            ? "online"
            : undefined;
  const storeText = text.replace(/amazon\s*pay/gi, "").replace(/phonepe/gi, "");
  const merchants = [
    ...new Set(
      cards.flatMap(
        (c) =>
          c.featureDetails?.rewardRules.flatMap((r) => r.merchants ?? []) ?? [],
      ),
    ),
  ].sort((a, b) => b.length - a.length);
  context.merchant = merchants.find((m) =>
    new RegExp(
      `(?<![a-z0-9])${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`,
      "i",
    ).test(storeText),
  );
  if (context.merchant && !context.channel) context.channel = "online";
  return context;
}
export function cardSpendCategory(text: string): SpendCategory | null {
  return categories.find(([, re]) => re.test(text))?.[0] ?? null;
}
export function cardSpendAmount(text: string): number | null {
  const match =
    text.match(
      /(?:₹|\brs\.?\s*|\binr\s*)\s*([\d,]+(?:\.\d{1,2})?)(?:\s*(k|lakh|lac|l))?(?![\dA-Za-z.])/i,
    ) ??
    text.match(
      /^(?:what about\s*)?([\d,]+)\s*(k|lakh|lac|l)?\s*(?:rupees)?\??$/i,
    );
  if (!match) return null;
  const unit = match[2]?.toLowerCase();
  const n =
    Number(match[1].replaceAll(",", "")) *
    (unit === "k"
      ? 1000
      : ["l", "lac", "lakh"].includes(unit ?? "")
        ? 100000
        : 1);
  return Number.isFinite(n) && n > 0 && n <= 1e12 ? Math.round(n) : null;
}
export interface CardAnswer {
  coded: string;
  shown: string;
  choices?: string[];
}
const cardWords =
  /\b(cards?|cashback|points?|rewards?|lounges?|annual fees?|fee waiver)\b|\[C\d+\]/i;
export function isCardBenefitQuestion(
  history: { role: string; content: string }[],
): boolean {
  const q = history.at(-1)?.content ?? "";
  if (/\b(prepay|repay|debt|loan|outstanding|pay off)\b/i.test(q)) return false;
  const previous =
    history
      .slice(0, -1)
      .filter((t) => t.role === "user")
      .at(-1)?.content ?? "";
  return (
    cardWords.test(q) ||
    (cardSpendAmount(q) !== null &&
      /^(?:what about\s*)?(?:₹|rs\.?|inr)?\s*[\d,.]+\s*(?:k|lakh|lac|l|rupees)?\??$/i.test(
        q.trim(),
      ) &&
      cardWords.test(previous))
  );
}
/** Common card questions are answered locally. AI never computes or invents reward values. */
export function answerCardQuestion(
  cards: Card[],
  today: string,
  history: { role: string; content: string }[],
): CardAnswer | null {
  const question = history.at(-1)?.content ?? "";
  const previous =
    history
      .slice(0, -1)
      .filter((t) => t.role === "user")
      .at(-1)?.content ?? "";
  const followup =
    cardSpendAmount(question) !== null &&
    /^(?:what about\s*)?(?:₹|rs\.?|inr)?\s*[\d,.]+\s*(?:k|lakh|lac|l|rupees)?\??$/i.test(
      question.trim(),
    ) &&
    /\b(cards?|cashback|reward)\b/i.test(previous);
  if (!isCardBenefitQuestion(history)) return null;
  const sorted = [...cards].sort((a, b) => a.id.localeCompare(b.id));
  const names: Record<string, string> = {};
  const code = new Map<string, string>();
  sorted.forEach((c, n) => {
    code.set(c.id, `[C${n + 1}]`);
    names[`[C${n + 1}]`] = c.label;
  });
  const result = (coded: string, choices?: string[]): CardAnswer => ({
    coded,
    shown: restoreNames(coded, names),
    choices,
  });
  if (!cards.length)
    return result(
      "Add your cards first in Cards. A few basic reward and lounge details are enough to get started.",
    );
  const mentioned = sorted.filter(
    (c) =>
      question.toLowerCase().includes(c.label.toLowerCase()) ||
      question.includes(code.get(c.id)!),
  );
  const selected = /which card|best card|compare.*card/i.test(question)
    ? sorted
    : mentioned.length
      ? mentioned
      : sorted;
  const current = selected.filter(
    (c) => c.featureDetails && benefitsCurrent(c.featureDetails, today),
  );
  if (/\blounges?\b/i.test(question)) {
    const lines = current.flatMap((c) =>
      c.featureDetails!.lounges.map((r) => {
        const a = loungeAllowance(c, r, today);
        return `- ${code.get(c.id)}: ${r.name}, ${a.conditional ? "conditional benefit, select after qualifying spend" : a.annualUnverified ? `${a.periodRemaining} this quarter; annual year reset not confirmed` : a.remaining === null ? "set the card-year start to count visits" : `${a.remaining} of ${r.visits} visits left`}. ${PERIOD_LABELS[r.period]}. ${r.conditions || "Access conditions are not recorded; check with your issuer."}`;
      }),
    );
    return result(
      lines.length
        ? `${lines.join("\n")}\n\nRemaining visits come from your manual log. They do not confirm entry eligibility. Update visits in Cards → Lounges.`
        : "No current lounge allowance is recorded. Add it in Cards → Edit benefits, including any spend condition.",
    );
  }
  if (/\b(milestone|waiver)\b/i.test(question)) {
    const lines = selected.flatMap((c) =>
      c.milestones.map((m) => {
        const s = milestoneState(m, today, c);
        return `- ${code.get(c.id)}: ${m.name}. Target ${formatINR(m.target)}, ${formatINR(s.remaining)} spend left in this period. ${m.reward ?? "Reward not recorded."}`;
      }),
    );
    return result(
      lines.length
        ? `${lines.join("\n")}\n\nBased on logged statements, excluding recorded card EMIs. The issuer confirms benefits and waivers.`
        : "No milestones are recorded yet. Add a fee-waiver target or spending reward in your card setup.",
    );
  }
  if (
    /\b(annual fees?|renewal fees?|card fees?)\b/i.test(question) &&
    !/which card|best card/i.test(question)
  )
    return result(
      selected
        .map(
          (c) =>
            `- ${code.get(c.id)}: ${c.annualFee === null ? "annual fee not set" : `${formatINR(c.annualFee)} annual fee`}.`,
        )
        .join("\n") +
        "\n\nUse your issuer's terms to check GST and any waiver conditions.",
    );
  if (
    /\b(cap|caps|conversion|convert|redeem|redemption|points)\b/i.test(
      question,
    ) &&
    !cardSpendCategory(question)
  ) {
    const lines = current.flatMap((c) =>
      c.featureDetails!.rewardRules.map(
        (r) =>
          `- ${code.get(c.id)}: ${r.category === "general" ? "general spending" : SPEND_CATEGORIES[r.category]}, ${rewardLabel(r)}. ${r.points ? rewardValueLabel(r) + ". " : ""}${r.cap !== null ? `Cash-value cap ${formatINR(r.cap)}. ` : ""}${r.points?.cap !== null && r.points?.cap !== undefined ? `Points cap ${r.points.cap}. ` : ""}${r.capPeriod ? PERIOD_LABELS[r.capPeriod] + ". " : ""}${r.conditions || "Merchant conditions not recorded."}`,
      ),
    );
    return result(
      lines.length
        ? `${lines.join("\n")}\n\nThese are your saved terms. Cap usage is not tracked; point values apply only to the stated redemption.`
        : "No current reward rates are recorded. Add cashback or points details in Cards → Edit benefits. Unknown point values can stay blank.",
    );
  }
  const category =
    cardSpendCategory(codeAskText(question, names)) ??
    (followup ? cardSpendCategory(codeAskText(previous, names)) : null);
  if (!category && !/which card|best card|cashback|reward|earn/i.test(question))
    return null;
  if (!category)
    return result(
      "What are you spending on? Choose a category, and include the amount for a reward comparison.",
      [
        "Which card for ₹5,000 on groceries?",
        "Which card for ₹2,000 on dining?",
        "How many lounge visits do I have left?",
      ],
    );
  const amount = cardSpendAmount(question);
  if (amount === null)
    return result(
      `How much are you spending on ${SPEND_CATEGORIES[category].toLowerCase()}? This helps account for reward caps and points earning steps.`,
      [1000, 5000, 10000].map(
        (n) =>
          `Which card for ${formatINR(n)} on ${SPEND_CATEGORIES[category].toLowerCase()}?`,
      ),
    );
  const context = cardSpendContext(
    codeAskText(followup ? `${previous} ${question}` : question, names),
    selected,
  );
  if (
    !context.channel &&
    !context.merchant &&
    selected.some((c) =>
      c.featureDetails?.rewardRules.some(
        (r) => r.channel || r.merchants?.length,
      ),
    )
  )
    return result(
      "How are you paying? App and store-specific rates can change the answer.",
      [
        `Which card for ${formatINR(amount)} on ${SPEND_CATEGORIES[category].toLowerCase()} online?`,
        `Which card for ${formatINR(amount)} on ${SPEND_CATEGORIES[category].toLowerCase()} using PhonePe?`,
        `Which card for ${formatINR(amount)} on ${SPEND_CATEGORIES[category].toLowerCase()} in store?`,
      ],
    );
  const matches = compareCardRewards(
    selected,
    category,
    amount,
    today,
    context,
  );
  const unique = matches.filter(
    (m, i) => matches.findIndex((x) => x.cardId === m.cardId) === i,
  );
  const top = unique[0];
  if (!top)
    return result(
      `I can't compare ${SPEND_CATEGORIES[category].toLowerCase()} yet. Add an applicable reward rate, and a redemption value if it's a points card. Expired terms and unknown point values are left out.`,
    );
  const lines = [
    `For ${formatINR(amount)} on ${SPEND_CATEGORIES[category].toLowerCase()}, ${code.get(top.cardId)} has the highest estimated reward among your saved, comparable rates: up to ${formatINR(top.upperReward)}.`,
    `${rewardLabel(top.rule)}.${top.rule.points ? ` ${rewardValueLabel(top.rule)}.` : ""}`,
    top.rule.conditions ||
      "Merchant eligibility and exclusions are not recorded. Check them with your issuer.",
  ];
  if (unique[1])
    lines.push(
      `Next: ${code.get(unique[1].cardId)}, up to ${formatINR(unique[1].upperReward)}. ${unique[1].rule.conditions || "Check issuer conditions."}`,
    );
  lines.push(
    "Caps already used and exact merchant eligibility are not tracked. This comparison is conditional on the saved terms.",
  );
  return result(lines.join("\n\n"));
}
