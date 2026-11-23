import Decimal from "decimal.js-light";
export const FinancialDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});
/** Effective annual returns, with contributions at the end of each full month. */
export function growth(rate: number, months: number) {
  if (!Number.isFinite(rate) || rate <= -100 || rate > 100)
    throw Error("Expected return must be greater than -100% and at most 100%.");
  return new FinancialDecimal(1)
    .plus(new FinancialDecimal(rate).div(100))
    .pow(new FinancialDecimal(months).div(12));
}
export function futureValueDecimal(
  saved: number,
  monthly: number,
  rate: number,
  months: number,
) {
  if (months <= 0) return new FinancialDecimal(saved);
  const r = growth(rate, 1).minus(1),
    g = growth(rate, months);
  return new FinancialDecimal(saved)
    .times(g)
    .plus(
      r.isZero()
        ? new FinancialDecimal(monthly).times(months)
        : new FinancialDecimal(monthly).times(g.minus(1)).div(r),
    );
}
export function requiredMonthlyDecimal(
  target: number,
  saved: number,
  rate: number,
  months: number,
) {
  if (months <= 0) return new FinancialDecimal(0);
  const gap = new FinancialDecimal(target).minus(
    new FinancialDecimal(saved).times(growth(rate, months)),
  );
  if (gap.lessThanOrEqualTo(0)) return new FinancialDecimal(0);
  const r = growth(rate, 1).minus(1);
  return r.isZero()
    ? gap.div(months)
    : gap.times(r).div(growth(rate, months).minus(1));
}
