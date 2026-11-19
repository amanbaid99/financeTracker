export function budgetSipHref(monthly: number) {
  return Number.isSafeInteger(monthly) && monthly > 0 && monthly <= 1e9 ? `/goals/sip?monthly=${monthly}` : null;
}
export function parseSipMonthly(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const amount=Number(value);
  return Number.isSafeInteger(amount)&&amount>0&&amount<=1e9?amount:null;
}
