import type { RiskProfile } from "./types";

export const RISK_QUESTIONS = [
  {
    id: "fall",
    question: "If your investments fell 20% in a month, what would you do?",
    options: ["Sell to stop the loss", "Wait it out", "Invest more while prices are low"],
  },
  {
    id: "experience",
    question: "How long have you invested in market-linked options like equity funds or stocks?",
    options: ["Never", "A few years", "More than 5 years"],
  },
  {
    id: "stability",
    question: "How steady is your income?",
    options: ["It changes a lot", "Mostly steady", "Very steady"],
  },
] as const;

/** Each answer scores 0-2. 0-1 conservative, 2-4 moderate, 5-6 aggressive. */
export function riskFromAnswers(answers: number[]): RiskProfile {
  const score = answers.slice(0, 3).reduce((s, a) => s + Math.max(0, Math.min(2, Math.round(a))), 0);
  if (score <= 1) return "conservative";
  if (score >= 5) return "aggressive";
  return "moderate";
}
