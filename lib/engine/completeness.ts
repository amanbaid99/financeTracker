import type { EngineConfig } from "./config";
import type { FinanceData } from "./types";

export type CompletenessKey = keyof EngineConfig["completeness"]["weights"];

export interface MissingItem {
  key: CompletenessKey;
  label: string;
  why: string;
  weight: number;
}

export interface CompletenessResult {
  score: number;
  missing: MissingItem[];
  topMissing: MissingItem[];
  reason: string;
}

const COPY: Record<CompletenessKey, { label: string; why: string }> = {
  income: {
    label: "Add your income",
    why: "Everything starts from what you earn each month.",
  },
  expenses: {
    label: "Add your expenses",
    why: "So your emergency fund target is real, not estimated.",
  },
  insurance: {
    label: "Add your insurance",
    why: "So we can check you're covered before you invest.",
  },
  liabilities: {
    label: "Add your loans and cards",
    why: "So costly debt gets paid off before anything else.",
  },
  holdings: {
    label: "Add your savings and investments",
    why: "So we know how much of your safety net already exists.",
  },
  household: {
    label: "Tell us about your household",
    why: "Dependents change how big your emergency fund and life cover should be.",
  },
  risk: {
    label: "Answer 3 risk questions",
    why: "So long-term goals use a mix you're comfortable holding.",
  },
};

export function computeCompleteness(data: FinanceData, cfg: EngineConfig): CompletenessResult {
  const a = data.profile.answered;
  const known: Record<CompletenessKey, boolean> = {
    income: data.incomes.length > 0,
    expenses: data.expenses.length > 0 || a.includes("expenses"),
    insurance: data.insurance.length > 0 || a.includes("insurance"),
    liabilities: data.liabilities.length > 0 || a.includes("liabilities"),
    holdings: data.holdings.length > 0 || a.includes("holdings"),
    household: a.includes("household") || data.profile.maritalStatus !== null,
    risk: data.profile.riskProfile !== null,
  };
  const weights = cfg.completeness.weights;
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  let have = 0;
  const missing: MissingItem[] = [];
  for (const key of Object.keys(weights) as CompletenessKey[]) {
    if (known[key]) have += weights[key];
    else missing.push({ key, weight: weights[key], ...COPY[key] });
  }
  missing.sort((x, y) => y.weight - x.weight);
  const score = total > 0 ? Math.round((have / total) * 100) : 0;
  return {
    score,
    missing,
    topMissing: missing.slice(0, 2),
    reason:
      score === 100
        ? "Your profile is complete, so recommendations use your real numbers."
        : "More answers mean sharper recommendations.",
  };
}
