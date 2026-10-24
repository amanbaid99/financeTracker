import { describe, expect, it } from "vitest";
import { computeCompleteness } from "@/lib/engine/completeness";
import { mergeConfig } from "@/lib/engine/config";
import { analyze } from "@/lib/engine";
import { avalancheOrder, emergencyMonths, liquidAssets } from "@/lib/engine/ladder";
import type { FinanceData } from "@/lib/engine/types";
import { makeData, profile, solidBasics, TODAY } from "./fixtures";

const cfg = mergeConfig();
const run = (d: FinanceData, overrides: unknown = {}) => analyze(d, overrides, TODAY);
const stepStatus = (d: FinanceData, key: string) => run(d).ladder.find((s) => s.key === key)!.status;

describe("priority ladder", () => {
  it("step 0: essentials above base income makes cash flow the focus", () => {
    const d = solidBasics({
      expenses: [
        { id: "e1", category: "Rent", amountMonthly: 70_000, isEssential: true },
        { id: "e2", category: "Groceries", amountMonthly: 40_000, isEssential: true },
      ],
    });
    const a = run(d);
    expect(a.nextFocus?.title).toBe("Fix monthly cash flow");
    expect(a.nextFocus?.gap).toBe(11_000);
    expect(a.nextFocus?.reason).toContain("Rent");
  });

  it("step 1: starter buffer with gap, monthly amount and months", () => {
    const d = solidBasics({
      holdings: [{ id: "h", kind: "savings", name: null, category: "savings_account", currentValue: 20_000, monthlySip: null }],
    });
    const a = run(d);
    expect(a.nextFocus?.step.key).toBe("starter_buffer");
    expect(a.nextFocus?.gap).toBe(21_000); // 41k essentials (40k + 1k premiums) minus 20k
    expect(a.nextFocus?.monthly).toBe(20_000);
    expect(a.nextFocus?.monthsToComplete).toBe(2);
  });

  it("step 1: unknown savings asks instead of assuming", () => {
    const d = solidBasics({ holdings: [] });
    d.profile.answered = d.profile.answered.filter((s) => s !== "holdings");
    const a = run(d);
    expect(a.nextFocus?.title).toBe("Tell us about your savings");
    expect(a.nextFocus?.monthly).toBeNull();
  });

  it("step 1: an answered 'no savings' is a real zero", () => {
    const d = solidBasics({ holdings: [] });
    expect(run(d).nextFocus?.step.key).toBe("starter_buffer");
  });

  it("step 2: employer-only health cover does not complete the step", () => {
    const d = solidBasics({
      insurance: [{ id: "p", kind: "health", source: "employer", coverAmount: 500_000, premium: null, renewalMonth: null }],
    });
    const a = run(d);
    expect(a.nextFocus?.step.key).toBe("health_insurance");
    expect(a.nextFocus?.gap).toBe(1_000_000);
    expect(a.nextFocus?.reason).toContain("ends when the job does");
  });

  it("step 2: a policy only for parents doesn't count as your cover", () => {
    const d = solidBasics({
      insurance: [
        { id: "p", kind: "health", source: "personal", covers: "others", coverAmount: 1_000_000, premium: 30_000, renewalMonth: 4 },
      ],
    });
    const a = run(d);
    expect(a.nextFocus?.step.key).toBe("health_insurance");
    expect(a.nextFocus?.reason).toContain("doesn't cover you");
    expect(a.budget.essentials.insurancePremiums).toBe(2_500);
  });

  it("step 2: a family floater that includes you counts", () => {
    const d = solidBasics({
      insurance: [
        { id: "p", kind: "health", source: "family", covers: "family", coverAmount: 1_000_000, premium: 30_000, renewalMonth: 4 },
      ],
    });
    expect(stepStatus(d, "health_insurance")).toBe("done");
  });

  it("step 2: smaller cities need ₹5L", () => {
    const d = solidBasics({
      profile: profile({ cityTier: "tier2" }),
      insurance: [{ id: "p", kind: "health", source: "family", coverAmount: 500_000, premium: 12_000, renewalMonth: 1 }],
    });
    expect(stepStatus(d, "health_insurance")).toBe("done");
  });

  it("step 2: unknown insurance asks", () => {
    const d = solidBasics({ insurance: [] });
    d.profile.answered = d.profile.answered.filter((s) => s !== "insurance");
    expect(run(d).nextFocus?.title).toBe("Tell us about your insurance");
  });

  it("step 3: not needed when single with no dependents", () => {
    expect(stepStatus(solidBasics(), "term_insurance")).toBe("not_needed");
  });

  it("step 3: dependents need 15x income + loans - liquid", () => {
    const d = solidBasics({
      profile: profile({ maritalStatus: "married", dependents: 2, soleEarner: true }),
    });
    const a = run(d);
    expect(a.nextFocus?.step.key).toBe("term_insurance");
    // 15 x 12L + 0 loans - 2L liquid = 1.78Cr
    expect(a.nextFocus?.gap).toBe(17_800_000);
    expect(a.nextFocus?.monthly).toBeNull();
  });

  it("step 3: married with loans someone would inherit needs cover", () => {
    const d = solidBasics({
      profile: profile({ maritalStatus: "married", dependents: 0 }),
      liabilities: [{ id: "l", kind: "home", outstanding: 3_000_000, interestRate: 8.5, emi: 0 }],
    });
    expect(stepStatus(d, "term_insurance")).toBe("todo");
  });

  it("step 3: enough term cover completes it", () => {
    const d = solidBasics({
      profile: profile({ maritalStatus: "married", dependents: 1 }),
      insurance: [
        { id: "p", kind: "health", source: "personal", coverAmount: 1_000_000, premium: 12_000, renewalMonth: 4 },
        { id: "t", kind: "term", source: "personal", coverAmount: 20_000_000, premium: 15_000, renewalMonth: 4 },
      ],
    });
    expect(stepStatus(d, "term_insurance")).toBe("done");
  });

  it("step 3: unknown household asks", () => {
    const d = solidBasics({ profile: profile({ dependents: null, maritalStatus: null, answered: ["income", "expenses", "insurance", "liabilities", "holdings"] }) });
    expect(run(d).nextFocus?.title).toBe("Tell us about your household");
  });

  it("step 4: high-interest debt in avalanche order; home loans don't block", () => {
    const d = solidBasics({
      liabilities: [
        { id: "pl", kind: "personal_loan", outstanding: 100_000, interestRate: 14, emi: 0 },
        { id: "cc", kind: "credit_card", outstanding: 50_000, interestRate: 36, emi: 0 },
        { id: "hl", kind: "home", outstanding: 3_000_000, interestRate: 8.5, emi: 0 },
      ],
    });
    const a = run(d);
    expect(a.nextFocus?.step.key).toBe("high_interest_debt");
    expect(a.nextFocus?.gap).toBe(150_000);
    expect(a.nextFocus?.step.debts?.map((x) => x.id)).toEqual(["cc", "pl"]);
  });

  it("step 4: a card with no rate entered counts as high interest", () => {
    const d = solidBasics({
      liabilities: [{ id: "cc", kind: "credit_card", outstanding: 10_000, interestRate: null, emi: null }],
    });
    expect(stepStatus(d, "high_interest_debt")).toBe("todo");
  });

  it("step 4: only low-rate loans is done", () => {
    const d = solidBasics({
      liabilities: [{ id: "ed", kind: "education", outstanding: 500_000, interestRate: 9, emi: 0 }],
    });
    expect(stepStatus(d, "high_interest_debt")).toBe("done");
  });

  it("step 5: emergency fund gap uses months by profile", () => {
    const d = solidBasics({
      holdings: [{ id: "h", kind: "savings", name: null, category: "savings_account", currentValue: 100_000, monthlySip: null }],
    });
    const a = run(d);
    expect(a.nextFocus?.step.key).toBe("emergency_fund");
    expect(a.nextFocus?.gap).toBe(23_000); // 3 x 41k - 100k
  });

  it("step 5: existing SIPs keep running and only new savings go to the step", () => {
    const d = solidBasics({
      holdings: [
        { id: "h", kind: "savings", name: null, category: "savings_account", currentValue: 100_000, monthlySip: null },
        { id: "m", kind: "mutual_fund", name: "Index", category: "equity_index", currentValue: 50_000, monthlySip: 15_000 },
      ],
    });
    const a = run(d);
    // need = ceil(23k / 12) + 15k SIPs = 16,917; floor is 20k, so savings 20k, new savings 5k.
    expect(a.nextFocus?.monthly).toBe(5_000);
    expect(a.nextFocus?.monthsToComplete).toBe(5);
  });

  it("step 6: no goals asks for the first goal", () => {
    const a = run(solidBasics());
    expect(a.nextFocus?.title).toBe("Set your first goal");
  });

  it("step 6: goals get savings with the retirement baseline first", () => {
    const d = solidBasics({
      goals: [
        { id: "r", name: "Retirement", type: "retirement", targetToday: 15_000_000, targetDate: "2056-10-24", priority: 2, inflationRate: null, savedAmount: 0 },
        { id: "t", name: "Trip", type: "travel", targetToday: 200_000, targetDate: "2027-10-24", priority: 1, inflationRate: null, savedAmount: 0 },
      ],
    });
    const a = run(d);
    expect(a.nextFocus?.title).toBe("Fund your goals");
    // Retirement gets its baseline first (plus more later in priority order).
    expect(a.nextFocus?.goalSplit?.[0].goalId).toBe("r");
    expect(a.nextFocus?.goalSplit?.[0].amount).toBeGreaterThanOrEqual(10_000);
    expect(a.nextFocus?.goalSplit?.some((g) => g.goalId === "t")).toBe(true);
    expect(a.nextFocus?.monthly).toBeGreaterThanOrEqual(20_000);
  });

  it("all done when every goal is funded", () => {
    const d = solidBasics({
      goals: [{ id: "t", name: "Trip", type: "travel", targetToday: 10_000, targetDate: "2027-10-24", priority: 1, inflationRate: null, savedAmount: 50_000 }],
    });
    expect(run(d).nextFocus).toBeNull();
  });

  it("config overrides change thresholds", () => {
    const a = run(solidBasics(), { ladder: { healthCoverMetro: 2_000_000 } });
    expect(a.nextFocus?.step.key).toBe("health_insurance");
  });
});

describe("emergency fund months", () => {
  const months = (d: FinanceData) => emergencyMonths(d, cfg).months;
  it("stable salary, no dependents: 3", () => expect(months(makeData())).toBe(3));
  it("stable salary with dependents: 6", () =>
    expect(months(makeData({ profile: profile({ dependents: 1 }) }))).toBe(6));
  it("variable salary: 6", () =>
    expect(months(makeData({ incomes: [{ id: "v", label: "v", type: "variable_salary", amountMonthly: 50_000 }] }))).toBe(6));
  it("multiple jobs: 4", () =>
    expect(
      months(
        makeData({
          incomes: [
            { id: "a", label: "a", type: "stable_salary", amountMonthly: 50_000 },
            { id: "b", label: "b", type: "stable_salary", amountMonthly: 20_000 },
          ],
        }),
      ),
    ).toBe(4));
  it("freelance: 9", () =>
    expect(months(makeData({ incomes: [{ id: "f", label: "f", type: "freelance", amountMonthly: 50_000 }] }))).toBe(9));
  it("sole earner with dependents: 9", () =>
    expect(months(makeData({ profile: profile({ dependents: 2, soleEarner: true }) }))).toBe(9));
  it("freelance and sole earner with dependents: 12", () =>
    expect(
      months(
        makeData({
          profile: profile({ dependents: 2, soleEarner: true }),
          incomes: [{ id: "f", label: "f", type: "business", amountMonthly: 50_000 }],
        }),
      ),
    ).toBe(12));
});

describe("helpers", () => {
  it("liquid assets exclude money earmarked for other goals", () => {
    const d = makeData({
      holdings: [
        { id: "s", kind: "savings", name: null, category: null, currentValue: 100_000, monthlySip: null },
        { id: "e", kind: "mutual_fund", name: null, category: "equity_index", currentValue: 500_000, monthlySip: null },
      ],
      goals: [{ id: "g", name: "Trip", type: "travel", targetToday: 1, targetDate: "2027-01-01", priority: 1, inflationRate: null, savedAmount: 0 }],
      allocations: [{ goalId: "g", holdingId: "s", percent: 40 }],
    });
    expect(liquidAssets(d)).toBe(60_000);
  });

  it("avalanche puts unknown rates first, then highest rate", () => {
    const order = avalancheOrder([
      { id: "a", kind: "personal_loan", outstanding: 1, interestRate: 12, emi: null },
      { id: "b", kind: "credit_card", outstanding: 1, interestRate: null, emi: null },
      { id: "c", kind: "credit_card", outstanding: 1, interestRate: 40, emi: null },
    ]);
    expect(order.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
});

describe("completeness", () => {
  it("is 100 when every section is answered", () => {
    expect(computeCompleteness(solidBasics(), cfg).score).toBe(100);
  });

  it("weights sections and lists the top 2 missing", () => {
    const d = makeData({ expenses: [], profile: profile({ answered: [], riskProfile: null, maritalStatus: null }) });
    const c = computeCompleteness(d, cfg);
    expect(c.score).toBe(25);
    expect(c.topMissing.map((m) => m.key)).toEqual(["expenses", "insurance"]);
    expect(c.topMissing[0].why).toContain("emergency fund");
  });
});

describe("credit cards paid in full", () => {
  it("card dues reduce the cash free for emergencies", () => {
    const d = solidBasics({ cards: [{ id: "c", label: "Card", outstanding: 50_000, dueDay: 5 }] });
    expect(liquidAssets(d)).toBe(150_000);
    // 3 x 41k = 123k emergency target is still covered by 150k.
    expect(stepStatus(d, "emergency_fund")).toBe("done");
  });
});
