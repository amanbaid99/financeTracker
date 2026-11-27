export const EMERGENCY_MONTHS = [1, 3, 6, 12, 24] as const;
export interface EmergencyProgress {
  monthlyCosts: number;
  roundedMonthly: number;
  stages: {
    months: number;
    target: number;
    saved: number;
    progress: number;
    reached: boolean;
    stretch: boolean;
  }[];
}
/** Derived from assigned savings and fixed monthly costs, without reserving money twice. */
export function emergencyProgress(
  saved: number,
  monthlyCosts: number,
): EmergencyProgress | null {
  if (!Number.isFinite(monthlyCosts) || monthlyCosts <= 0) return null;
  const roundedMonthly = Math.ceil(monthlyCosts / 10000) * 10000;
  const corpus = Number.isFinite(saved) ? Math.max(0, saved) : 0;
  return {
    monthlyCosts,
    roundedMonthly,
    stages: EMERGENCY_MONTHS.map((months) => ({
      months,
      target: roundedMonthly * months,
      saved: corpus,
      progress: Math.min(1, corpus / (roundedMonthly * months)),
      reached: corpus >= roundedMonthly * months,
      stretch: months > 6,
    })),
  };
}

/** Expense-linked goals derive their main target; their stored amount is a fallback only. */
export function withEmergencyTarget<
  T extends { type: string; target: number; emergencyTargetMonths?: number },
>(goal: T, monthlyCosts: number): T {
  if (
    goal.type !== "emergency_fund" ||
    !goal.emergencyTargetMonths ||
    !EMERGENCY_MONTHS.some((m) => m === goal.emergencyTargetMonths)
  )
    return goal;
  const progress = emergencyProgress(0, monthlyCosts);
  return progress
    ? {
        ...goal,
        target: progress.roundedMonthly * goal.emergencyTargetMonths,
        targetType: "future",
        inflationPct: null,
      }
    : goal;
}
