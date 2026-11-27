import { FinancialDecimal as D, growth } from "./funding-math";
/** Corpus in today's purchasing power; monthly withdrawals start at retirement. */
export function retirementCorpusToday(
  monthlySpending: number,
  years: number,
  inflationPct: number,
  afterTaxReturnPct: number,
): number {
  if (
    !Number.isSafeInteger(monthlySpending) ||
    monthlySpending < 0 ||
    !Number.isInteger(years) ||
    years < 1 ||
    years > 60
  )
    throw Error("Check retirement spending and duration.");
  const realMonthly = growth(afterTaxReturnPct, 1).div(growth(inflationPct, 1));
  let corpus = new D(0);
  for (let month = 0; month < years * 12; month++)
    corpus = corpus.plus(new D(monthlySpending).div(realMonthly.pow(month)));
  return corpus.toDecimalPlaces(0, D.ROUND_CEIL).toNumber();
}
