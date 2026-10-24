// Builds the only data the AI ever sees: rounded numbers the engine already
// computed and generic labels. No names, emails, ages, cities, dates of birth,
// goal names typed by the user, holding names or loan nicknames.

import type { Analysis } from "@/lib/engine";
import type { GoalAnalysis } from "@/lib/engine/goals";

export type AiFeature = "next_focus" | "goal" | "plan_review";

const GOAL_LABELS: Record<string, string> = {
  emergency_fund: "emergency fund",
  insurance_premium_fund: "insurance premium fund",
  wedding: "wedding",
  house_down_payment: "house down payment",
  vehicle: "vehicle",
  education: "education",
  travel: "travel",
  retirement: "retirement",
  medical: "medical",
  custom: "other goal",
};

/** Rounds to 2 significant figures and formats in lakhs/crores. */
export function roughRupees(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "₹0";
  const abs = Math.abs(n);
  const mag = Math.pow(10, Math.floor(Math.log10(abs)) - 1);
  const r = Math.round(abs / mag) * mag;
  const sign = n < 0 ? "-" : "";
  if (r >= 1e7) return `${sign}₹${+(r / 1e7).toFixed(2)} crore`;
  if (r >= 1e5) return `${sign}₹${+(r / 1e5).toFixed(1)} lakh`;
  return `${sign}₹${r.toLocaleString("en-IN")}`;
}

function goalFacts(g: GoalAnalysis, index: number) {
  return {
    goal: `${GOAL_LABELS[g.type] ?? "goal"} (goal ${index + 1})`,
    priority: g.priority,
    no_deadline: g.openEnded,
    years_away: g.openEnded && g.estimatedMonths === null ? "not reached at current pace" : Math.round(g.years * 10) / 10,
    target_today: roughRupees(g.targetToday),
    target_future_after_inflation: roughRupees(g.futureTarget),
    inflation_pct: g.inflationPct,
    saved_so_far: roughRupees(g.currentAmount),
    required_monthly: roughRupees(g.requiredMonthly),
    or_start_with_yearly_step_up: g.requiredMonthly > 0 ? roughRupees(g.requiredMonthlyStepUp) : null,
    suggested_step_up_pct: g.stepUpPct,
    current_monthly_sip: roughRupees(g.linkedSip),
    status: g.status.replace("_", " "),
    planning_return_pct: g.returnPct,
    horizon: g.band.label,
    suggested_categories: g.categories,
    move_to_debt_flag: g.glidePath,
  };
}

/** Generic words the payload is allowed to contain even if a user typed them as a name. */
export function genericVocabulary(analysis: Analysis): string {
  return [
    ...Object.values(GOAL_LABELS),
    ...analysis.ladder.flatMap((s) => [s.name, s.reason]),
    ...analysis.config.goals.horizonBands.flatMap((b) => [b.label, ...b.categories]),
    ...analysis.config.goals.retirementExtraCategories,
    analysis.nextFocus?.title ?? "",
    "salary income bonus rent savings bank fund goal plan",
  ]
    .join(" | ")
    .toLowerCase();
}

export function buildFacts(analysis: Analysis, feature: AiFeature, goalId?: string): Record<string, unknown> {
  const { budget, ladder, nextFocus, completeness } = analysis;
  const base = {
    profile_completeness_pct: completeness.score,
    essentials_estimated: budget.essentials.estimated,
  };

  const focus = nextFocus
    ? {
        step: nextFocus.step.name,
        title: nextFocus.title,
        gap: roughRupees(nextFocus.gap),
        suggested_monthly: nextFocus.monthly === null ? null : roughRupees(nextFocus.monthly),
        months_to_complete: nextFocus.monthsToComplete,
        why: nextFocus.step.reason,
      }
    : { step: "all steps done" };

  if (feature === "next_focus") {
    return { ...base, next_focus: focus };
  }

  if (feature === "goal") {
    const i = analysis.goals.findIndex((g) => g.goalId === goalId);
    if (i === -1) throw new Error("Goal not found");
    return { ...base, goal: goalFacts(analysis.goals[i], i) };
  }

  return {
    ...base,
    monthly_budget: {
      base_income: roughRupees(budget.baseIncome),
      essentials_incl_emis: roughRupees(budget.essentials.total),
      savings_target: roughRupees(budget.split.savings),
      wants: roughRupees(budget.split.wants),
      surplus_to_plan: roughRupees(budget.monthlySurplus.ladder + budget.monthlySurplus.goals),
      cash_flow_ok: budget.cashFlowOk,
    },
    ladder: ladder.map((s) => ({ step: s.name, status: s.status.replace("_", " "), gap: roughRupees(s.gap) })),
    next_focus: focus,
    goals: analysis.goals.map(goalFacts),
  };
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PAN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
const PHONE = /\b[6-9]\d{9}\b/;
const LONG_NUMBER = /\d{11,}/;

/**
 * Last line of defence before anything leaves the server. Throws if the
 * payload contains something that looks personal.
 */
export function assertAnonymous(payload: string, personalStrings: string[]): void {
  if (EMAIL.test(payload)) throw new Error("Blocked: payload contains an email address");
  if (PAN.test(payload)) throw new Error("Blocked: payload contains a PAN-like value");
  if (PHONE.test(payload) || LONG_NUMBER.test(payload)) {
    throw new Error("Blocked: payload contains a phone or account-like number");
  }
  const lower = payload.toLowerCase();
  for (const s of personalStrings) {
    const t = s.trim().toLowerCase();
    if (t.length >= 3 && lower.includes(t)) throw new Error("Blocked: payload contains personal text");
  }
}
