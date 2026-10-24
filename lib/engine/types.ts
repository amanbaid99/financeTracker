// Plain data shapes the engine works on. The app maps database rows into these.
// Money is always integer rupees.

export type IncomeType =
  | "stable_salary"
  | "variable_salary"
  | "freelance"
  | "business"
  | "rental"
  | "bonus"
  | "other";

export type CityTier = "metro" | "tier2" | "tier3";
export type RiskProfile = "conservative" | "moderate" | "aggressive";
export type MaritalStatus = "single" | "married" | "other";

/** Profile sections a user has answered, even if the answer was "I have none". */
export type Section =
  | "household"
  | "income"
  | "expenses"
  | "insurance"
  | "liabilities"
  | "holdings"
  | "goals"
  | "risk";

export interface Profile {
  name: string;
  age: number | null;
  cityTier: CityTier | null;
  maritalStatus: MaritalStatus | null;
  dependents: number | null;
  soleEarner: boolean | null;
  riskProfile: RiskProfile | null;
  answered: Section[];
}

export interface IncomeStream {
  id: string;
  label: string;
  type: IncomeType;
  /** Typical monthly amount (for bonus: the one-off amount). */
  amountMonthly: number;
  /** Fixed part of a variable salary, if any. */
  fixedMonthly?: number | null;
  /** Last months of actual amounts, most recent first. */
  history?: number[];
  isGross?: boolean;
  isPrimary?: boolean;
  active?: boolean;
}

export interface Expense {
  id: string;
  category: string;
  amountMonthly: number;
  isEssential: boolean;
}

export type InsuranceKind = "health" | "term" | "other";
export type InsuranceSource = "personal" | "employer" | "family";

export interface InsurancePolicy {
  id: string;
  kind: InsuranceKind;
  source: InsuranceSource;
  coverAmount: number;
  /** Yearly premium you pay (monthly payments are converted to yearly). */
  premium: number | null;
  /** Who is insured. "others" (e.g. parents) is budgeted but isn't your own cover. */
  covers?: "self" | "family" | "others";
  /** False when the user chose not to budget or save for this premium. */
  inBudget?: boolean;
  renewalMonth: number | null;
}

export type LiabilityKind =
  | "credit_card"
  | "personal_loan"
  | "car"
  | "home"
  | "education"
  | "other";

export interface Liability {
  id: string;
  kind: LiabilityKind;
  label?: string | null;
  outstanding: number;
  interestRate: number | null;
  emi: number | null;
}

export type HoldingKind =
  | "savings"
  | "fd"
  | "ppf"
  | "epf"
  | "nps"
  | "mutual_fund"
  | "stock"
  | "gold"
  | "other";

export interface Holding {
  id: string;
  kind: HoldingKind;
  name: string | null;
  /** Category label, e.g. "liquid_fund", "equity_index". */
  category: string | null;
  currentValue: number;
  monthlySip: number | null;
  /** SIP rises by this % every 12 months (step-up SIP). */
  sipStepUpPct?: number | null;
  /** Planning return % a year. Null uses the category default from config. */
  expectedReturnPct?: number | null;
}

export type GoalType =
  | "emergency_fund"
  | "insurance_premium_fund"
  | "wedding"
  | "house_down_payment"
  | "vehicle"
  | "education"
  | "travel"
  | "retirement"
  | "medical"
  | "custom";

export interface Goal {
  id: string;
  name: string;
  type: GoalType;
  targetToday: number;
  /** ISO date (yyyy-mm-dd). */
  targetDate: string;
  priority: number;
  /** Percentage per year, e.g. 6. Null uses the default for the goal type. */
  inflationRate: number | null;
  savedAmount: number;
}

export interface GoalAllocation {
  goalId: string;
  holdingId: string;
  /** 0 to 100 */
  percent: number;
}

/** A credit card paid in full each month. Its outstanding is spoken-for cash, not debt. */
export interface CreditCard {
  id: string;
  label: string;
  outstanding: number;
  dueDay: number | null;
}

/** A cost that comes round every few months; the budget sets aside a monthly share. */
export interface PlannedExpense {
  id: string;
  name: string;
  amount: number;
  everyMonths: number;
  nextDue: string | null;
  inBudget: boolean;
}

export interface FinanceData {
  profile: Profile;
  incomes: IncomeStream[];
  expenses: Expense[];
  insurance: InsurancePolicy[];
  liabilities: Liability[];
  holdings: Holding[];
  goals: Goal[];
  allocations: GoalAllocation[];
  cards?: CreditCard[];
  plannedExpenses?: PlannedExpense[];
}
