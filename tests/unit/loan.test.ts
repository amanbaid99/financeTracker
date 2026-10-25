import { describe, expect, it } from "vitest";
import { emiDateIn, emisBetween, lastEmiOnOrBefore, nextEmiAfter } from "@/lib/dates";
import { balanceAfter, emiFor, foreclosureRate, interestSavedIfClosedAt, loanState, monthsToClose } from "@/lib/loan";
import { projectedValue, trackGoal, type GoalInput, type Investment, type Link } from "@/lib/tracker";

const TODAY = "2026-10-25";

describe("loan maths", () => {
  it("matches a standard EMI: 10 lakh at 9% for 10 years", () => {
    expect(emiFor(1_000_000, 9, 120)).toBe(12_668);
    expect(monthsToClose(1_000_000, 9, 12_668)).toBe(120);
    expect(balanceAfter(1_000_000, 9, 12_668, 120)).toBeLessThan(50);
    expect(monthsToClose(1_000_000, 9, 7_000)).toBeNull(); // doesn't cover interest
    expect(monthsToClose(12_000, 0, 1_000)).toBe(12);
  });

  it("splits this month's EMI and rolls the balance forward from the date entered", () => {
    const fresh = loanState({ outstanding: 1_000_000, emi: 12_668, ratePct: 9, monthsLeft: null, asOf: TODAY }, TODAY);
    expect(fresh.interestThisMonth).toBe(7_500);
    expect(fresh.principalThisMonth).toBe(5_168);
    expect(fresh.monthsLeft).toBe(120);
    expect(fresh.endDate).toBe("2036-10-25");
    expect(fresh.interestLeft).toBeGreaterThan(510_000);
    expect(fresh.interestLeft).toBeLessThan(521_000);

    // Six EMIs later the balance has dropped on its own.
    const later = loanState({ outstanding: 1_000_000, emi: 12_668, ratePct: 9, monthsLeft: null, asOf: "2026-04-25" }, TODAY);
    expect(later.balance).toBe(Math.round(balanceAfter(1_000_000, 9, 12_668, 6)));
    expect(later.monthsLeft).toBe(114);
  });

  it("works out the EMI from months left", () => {
    const s = loanState({ outstanding: 1_000_000, emi: null, ratePct: 9, monthsLeft: 120, asOf: TODAY }, TODAY);
    expect(s.emi).toBe(12_668);
  });

  it("counts interest saved by closing early", () => {
    const s = loanState({ outstanding: 1_000_000, emi: 12_668, ratePct: 9, monthsLeft: null, asOf: TODAY }, TODAY);
    expect(interestSavedIfClosedAt(s, 0)).toBe(s.interestLeft);
    expect(interestSavedIfClosedAt(s, 60)).toBeGreaterThan(0);
    expect(interestSavedIfClosedAt(s, 60)).toBeLessThan(s.interestLeft!);
    expect(interestSavedIfClosedAt(s, 200)).toBe(0);
  });
});

describe("loan payoff goals", () => {
  const loanGoal = (over: Partial<GoalInput> = {}): GoalInput => ({
    id: "g",
    name: "Close car loan",
    type: "loan_payoff",
    target: 1_000_000,
    targetDate: "2029-10-25",
    inflationPct: null,
    loan: { outstanding: 1_000_000, emi: 12_668, ratePct: 9, monthsLeft: null, asOf: TODAY },
    ...over,
  });
  const fund: Investment = { id: "f", kind: "mutual_fund", name: null, category: "equity_index", value: 100_000, monthlySip: 5_000, returnPct: 11 };
  const links: Link[] = [{ goalId: "g", investmentId: "f", percent: 100 }];

  it("targets what's still owed on the date and the SIP to cover it", () => {
    const t = trackGoal(loanGoal(), [fund], links, TODAY);
    expect(t.futureTarget).toBe(Math.round(balanceAfter(1_000_000, 9, 12_668, 36)));
    expect(t.futureTarget).toBeLessThan(1_000_000);
    expect(t.status).toBe("behind");
    const total = t.monthlySip + t.extraSipNeeded;
    expect(projectedValue(t.current, total, t.returnPct, 36)).toBeGreaterThanOrEqual(t.futureTarget);
    expect(t.interestSaved).toBeGreaterThan(0);
  });

  it("says the EMIs close it first when the date is after the loan ends", () => {
    const t = trackGoal(loanGoal({ targetDate: "2040-01-01" }), [fund], links, TODAY);
    expect(t.emisCloseFirst).toBe(true);
    expect(t.reachDate).toBe("2036-10-25");
  });

  it("with no date, finds when savings catch up with the balance", () => {
    const t = trackGoal(loanGoal({ targetDate: null }), [fund], links, TODAY);
    expect(t.monthsToReach).not.toBeNull();
    const m = t.monthsToReach!;
    expect(projectedValue(100_000, 5_000, 11, m)).toBeGreaterThanOrEqual(balanceAfter(1_000_000, 9, 12_668, m));
    expect(projectedValue(100_000, 5_000, 11, m - 1)).toBeLessThan(balanceAfter(1_000_000, 9, 12_668, m - 1));
  });
});

describe("foreclosure charges", () => {
  const base = { outstanding: 1_000_000, emi: 12_668, ratePct: 9, monthsLeft: null, asOf: TODAY };

  it("adds GST to the charge", () => {
    expect(foreclosureRate({ foreclosurePct: 4, foreclosureGst: true })).toBeCloseTo(0.0472, 6);
    expect(foreclosureRate({ foreclosurePct: 4, foreclosureGst: false })).toBeCloseTo(0.04, 6);
    expect(loanState({ ...base, foreclosurePct: 4, foreclosureGst: true }, TODAY).feeToday).toBe(47_200);
    expect(loanState(base, TODAY).feeToday).toBe(0);
  });

  const g = (loan: GoalInput["loan"], targetDate: string | null): GoalInput => ({
    id: "g",
    name: "Car loan",
    type: "loan_payoff",
    target: 0,
    targetDate,
    inflationPct: null,
    loan,
  });

  it("needs the amount owed plus the charge, and nets the charge off the saving", () => {
    const plain = trackGoal(g(base, "2029-10-25"), [], [], TODAY);
    const withFee = trackGoal(g({ ...base, foreclosurePct: 4, foreclosureGst: true }, "2029-10-25"), [], [], TODAY);
    const owed = Math.round(balanceAfter(1_000_000, 9, 12_668, 36));
    expect(plain.futureTarget).toBe(owed);
    expect(withFee.futureTarget).toBe(owed + Math.round(owed * 0.0472));
    expect(withFee.foreclosureFee).toBe(Math.round(owed * 0.0472));
    expect(withFee.interestSaved).toBe(plain.interestSaved);
    expect(withFee.netSaving).toBe(withFee.interestSaved - withFee.foreclosureFee);
    expect(withFee.extraSipNeeded).toBeGreaterThan(plain.extraSipNeeded);
  });

  it("shows when the charge costs more than it saves", () => {
    const late = trackGoal(g({ ...base, foreclosurePct: 10, foreclosureGst: false }, "2036-06-25"), [], [], TODAY);
    expect(late.netSaving).toBeLessThan(0);
  });
});

describe("EMI dates", () => {
  it("finds EMI dates, clamping to short months", () => {
    expect(emiDateIn(2027, 2, 31)).toBe("2027-02-28");
    expect(lastEmiOnOrBefore("2026-10-25", 5)).toBe("2026-10-05");
    expect(lastEmiOnOrBefore("2026-10-03", 5)).toBe("2026-09-05");
    expect(nextEmiAfter("2026-10-25", 5)).toBe("2026-11-05");
    expect(nextEmiAfter("2026-10-05", 5)).toBe("2026-11-05");
    expect(nextEmiAfter("2026-12-10", 5)).toBe("2027-01-05");
    expect(emisBetween("2026-10-05", "2026-10-25", 5)).toBe(0);
    expect(emisBetween("2026-10-05", "2026-11-05", 5)).toBe(1);
    expect(emisBetween("2025-12-05", "2026-10-25", 5)).toBe(10);
  });

  it("drops the balance on the EMI date, not before", () => {
    const loan = { outstanding: 1_000_000, emi: 12_668, ratePct: 9, monthsLeft: null, asOf: "2026-10-05", emiDay: 5 };
    expect(loanState(loan, "2026-11-04").balance).toBe(1_000_000);
    expect(loanState(loan, "2026-11-05").balance).toBe(Math.round(balanceAfter(1_000_000, 9, 12_668, 1)));
    expect(loanState(loan, "2026-10-25").nextEmi).toBe("2026-11-05");
  });

  it("works out today's balance from the original loan", () => {
    // 10 lakh at 9% for 10 years, first EMI on 5 Jan 2026: 10 EMIs paid by 25 Oct 2026.
    const s = loanState(
      { outstanding: 1_000_000, emi: null, ratePct: 9, monthsLeft: 120, asOf: "2025-12-05", emiDay: 5, firstEmi: "2026-01-05" },
      TODAY,
    );
    expect(s.emi).toBe(12_668);
    expect(s.emisPaid).toBe(10);
    expect(s.balance).toBe(Math.round(balanceAfter(1_000_000, 9, 12_668, 10)));
    expect(s.monthsLeft).toBe(110);
    expect(s.nextEmi).toBe("2026-11-05");
    expect(s.endDate).toBe("2035-12-05");
  });
});
