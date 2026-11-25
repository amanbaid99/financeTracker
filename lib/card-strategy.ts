import { z } from "zod";
import type { Card } from "./cards";

export const cardStrategySchema = z.object({
  useFor: z.string().trim().max(180),
  remember: z.string().trim().max(300),
});
export type CardStrategy = z.infer<typeof cardStrategySchema>;

/** Static starting reminders for confirmed terms, never a purchase comparison. */
export function cardStrategy(card: Card): CardStrategy {
  if (card.featureDetails?.strategy) return card.featureDetails.strategy;
  const name = card.label.toLowerCase();
  const rules = card.featureDetails?.rewardRules ?? [];
  if (
    name.includes("phonepe") &&
    rules.some(
      (r) =>
        (r.category === "insurance" ||
          r.eligibleCategories?.includes("insurance")) &&
        r.channel === "phonepe" &&
        r.cashbackBps === 1000 &&
        r.cap === 500,
    ) &&
    rules.some(
      (r) => r.channel === "online" && r.cashbackBps === 500 && r.cap === 1000,
    ) &&
    rules.some(
      (r) =>
        r.channel === "phonepe" &&
        r.cashbackBps === 1000 &&
        r.cap === 1500 &&
        r.capPeriod === "month",
    )
  )
    return {
      useFor: "PhonePe bills, recharges and insurance",
      remember:
        "10% on eligible in-app spends. Non-insurance: ₹1,500/month cap; insurance: ₹500/month. Other eligible online shopping: 5%, up to ₹1,000/month. Exclusions apply.",
    };
  if (
    name.includes("millennia") &&
    rules.some((r) => r.cashbackBps === 100 && r.cap === 1000) &&
    rules.some(
      (r) =>
        r.cashbackBps === 500 &&
        r.cap === 1000 &&
        ["swiggy", "zomato", "myntra"].every((m) =>
          r.merchants?.some((x) => x.toLowerCase() === m),
        ),
    )
  )
    return {
      useFor: "Partner shopping, food and entertainment",
      remember:
        "5% at listed partners, up to ₹1,000/month. Use partners such as Swiggy, Zomato and Myntra. Other eligible spends, including merchant UPI: 1%, capped at ₹1,000/month. ₹50 per cashback redemption.",
    };
  if (
    name.includes("amazon") &&
    rules.some(
      (r) =>
        r.cashbackBps === 500 &&
        r.merchants?.some((m) => m.toLowerCase().includes("amazon")),
    )
  )
    return {
      useFor: "Amazon shopping, flights and hotels",
      remember:
        "5% on eligible Amazon purchases. Eligible bills, recharges, gift cards and partners: 2%. Check eligibility before paying.",
    };
  if (
    name.includes("travelone") &&
    rules.some(
      (r) =>
        r.points?.perSpend === 4 &&
        r.points.spend === 100 &&
        r.points.valuePaise === 180 &&
        r.points.cap === 50000 &&
        r.points.redemption.toLowerCase().includes("accor"),
    )
  )
    return {
      useFor: "Travel bookings and foreign-currency spends",
      remember:
        "4 points per ₹100 on eligible travel and forex; 50,000-point monthly accelerated cap. Save points for Accor hotels at your chosen ₹1.80/point value. Check forex charges and booking prices separately.",
    };
  return { useFor: "", remember: "" };
}
