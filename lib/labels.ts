import type { GoalStatus } from "@/lib/engine/goals";
import type { GoalType, HoldingKind, IncomeType, LiabilityKind } from "@/lib/engine/types";

/** Must-pay cost categories the budget builder asks about. */
export const MUST_PAY = ["Rent", "Groceries", "Utilities and phone", "Transport", "Family support", "Other fixed costs"];

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  stable_salary: "Salary (same every month)",
  variable_salary: "Salary with incentives or commission",
  freelance: "Freelance",
  business: "Business",
  rental: "Rental income",
  bonus: "Bonus or one-off",
  other: "Other regular income",
};

export const LIABILITY_LABELS: Record<LiabilityKind, string> = {
  credit_card: "Credit card debt (carried over)",
  personal_loan: "Personal loan",
  car: "Car or bike loan",
  home: "Home loan",
  education: "Education loan",
  other: "Other loan",
};

export const HOLDING_KIND_LABELS: Record<HoldingKind, string> = {
  savings: "Bank savings / cash",
  fd: "Fixed or recurring deposit",
  ppf: "PPF",
  epf: "EPF / VPF",
  nps: "NPS",
  mutual_fund: "Mutual fund",
  stock: "Stocks",
  gold: "Gold",
  other: "Other",
};

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  retirement: "Retirement",
  emergency_fund: "Emergency fund",
  house_down_payment: "House down payment",
  education: "Education",
  wedding: "Wedding",
  vehicle: "Vehicle",
  travel: "Travel",
  medical: "Medical",
  insurance_premium_fund: "Insurance premium fund",
  custom: "Something else",
};

export const STATUS_BADGE: Record<GoalStatus, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
  funded: { label: "Funded", variant: "success" },
  on_track: { label: "On track", variant: "success" },
  slightly_behind: { label: "Slightly behind", variant: "warning" },
  behind: { label: "Behind", variant: "danger" },
  open: { label: "No deadline", variant: "default" },
};
