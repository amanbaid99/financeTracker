import type { FinanceData, Profile } from "@/lib/engine/types";

export const TODAY = "2026-10-24";

export function profile(p: Partial<Profile> = {}): Profile {
  return {
    name: "Test",
    age: 30,
    cityTier: "metro",
    maritalStatus: "single",
    dependents: 0,
    soleEarner: false,
    riskProfile: "moderate",
    answered: ["household", "income", "expenses", "insurance", "liabilities", "holdings", "risk"],
    ...p,
  };
}

/** A salaried single person in a metro with everything answered and nothing set up. */
export function makeData(over: Partial<FinanceData> = {}): FinanceData {
  return {
    profile: profile(),
    incomes: [{ id: "i1", label: "Salary", type: "stable_salary", amountMonthly: 100_000 }],
    expenses: [{ id: "e1", category: "Rent", amountMonthly: 40_000, isEssential: true }],
    insurance: [],
    liabilities: [],
    holdings: [],
    goals: [],
    allocations: [],
    ...over,
  };
}

/** Everything through step 5 done for the default data. */
export function solidBasics(over: Partial<FinanceData> = {}): FinanceData {
  return makeData({
    insurance: [
      { id: "p1", kind: "health", source: "personal", coverAmount: 1_000_000, premium: 12_000, renewalMonth: 4 },
    ],
    holdings: [
      { id: "h1", kind: "savings", name: "Bank", category: "savings_account", currentValue: 200_000, monthlySip: null },
    ],
    ...over,
  });
}
