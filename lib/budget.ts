// The monthly budget, plan only: money in, money out, and what's free to
// invest. EMIs come from Credit and SIPs from Portfolio, so nothing is typed
// twice. Yearly payments (insurance, gym) belong in a bills fund, which is
// already a SIP, so they aren't costs here.

export interface Income {
  id: string;
  label: string;
  type: string;
  /** Take-home a month. */
  amount: number;
  active: boolean;
}

export interface Cost {
  id: string;
  /** What it's for: "Rent", "Groceries"... */
  name: string;
  amount: number;
}

export interface Budget {
  income: number;
  costs: number;
  emis: number;
  sips: number;
  /** Income left after costs, EMIs and SIPs already running. */
  free: number;
  /** Monthly total for the money plan: SIPs now plus what's free. */
  planMonthly: number;
  /** Share of income invested now, and with the free amount invested too. */
  rateNow: number;
  rateWithPlan: number;
}

export const INCOME_TYPES = [
  { value: "stable_salary", label: "Salary" },
  { value: "variable_salary", label: "Variable pay" },
  { value: "freelance", label: "Freelance" },
  { value: "business", label: "Business" },
  { value: "rental", label: "Rent received" },
  { value: "other", label: "Other" },
] as const;

/** Common monthly costs to add with a tap. */
export const COST_SUGGESTIONS = [
  "Rent",
  "Groceries",
  "Utilities and phone",
  "Transport",
  "Family support",
  "Subscriptions",
  "Day-to-day spending",
];

export function budget(opts: {
  incomes: Income[];
  costs: Cost[];
  emis: number;
  sips: number;
}): Budget {
  const income = opts.incomes
    .filter((i) => i.active)
    .reduce((s, i) => s + i.amount, 0);
  const costs = opts.costs.reduce((s, c) => s + c.amount, 0);
  const free = income - costs - opts.emis - opts.sips;
  const rate = (n: number) => (income > 0 ? n / income : 0);
  return {
    income,
    costs,
    emis: opts.emis,
    sips: opts.sips,
    free,
    planMonthly: opts.sips + Math.max(0, free),
    rateNow: rate(opts.sips),
    rateWithPlan: rate(opts.sips + Math.max(0, free)),
  };
}

/** A plain word on the savings rate. 20% or more is a common guide. */
export function rateNote(rate: number): { text: string; tone: "good" | "ok" | "low" } {
  if (rate >= 0.3) return { text: "Strong. Well above the usual 20% guide.", tone: "good" };
  if (rate >= 0.2) return { text: "Healthy. Meets the usual 20% guide.", tone: "good" };
  if (rate >= 0.1) return { text: "A start. The usual guide is 20% or more.", tone: "ok" };
  return { text: "Low. Try to work toward 20% of take-home.", tone: "low" };
}
