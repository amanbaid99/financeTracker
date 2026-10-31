import { describe, expect, it } from "vitest";
import { afterPayment, loanTotals, loanView, type Loan } from "@/lib/loans";

const TODAY = "2026-10-31";
const loan = (over: Partial<Loan> = {}): Loan => ({
  id: "l1",
  name: "Personal",
  type: "personal",
  cardId: null,
  principal: 300000,
  takenOn: "2025-08-01",
  ratePct: 12,
  emi: 10000,
  monthsLeft: null,
  totalEmis: 36,
  emiDay: 5,
  billDay: null,
  firstEmi: null,
  outstanding: 200000,
  asOf: "2026-10-05",
  foreclosurePct: null,
  foreclosureGst: true,
  payments: [],
  goal: null,
  ...over,
});

describe("loan view", () => {
  it("shows what's repaid against the amount withdrawn, and the next EMI", () => {
    const v = loanView(loan(), TODAY);
    expect(v.state.balance).toBe(200000);
    expect(v.repaid).toBe(100000);
    expect(v.progress).toBeCloseTo(1 / 3);
    expect(v.next).toMatchObject({ date: "2026-11-05", amount: 10000, label: "due in 5 days" });
    expect(v.emisLine).toMatch(/of 36 EMIs paid$/);
  });

  it("asks about an EMI from the last week that isn't marked paid", () => {
    const v = loanView(loan({ asOf: "2026-09-27", emiDay: 28 }), TODAY);
    expect(v.next).toMatchObject({ date: "2026-10-28", label: "overdue by 3 days", tone: "danger" });
  });

  it("marking an EMI paid takes it off and moves on to the next one", () => {
    const l = loan();
    const after = afterPayment(l, "2026-11-05");
    expect(after.asOf).toBe("2026-11-05");
    expect(after.outstanding).toBe(Math.round(200000 * 1.01 - 10000));
    const v = loanView(
      { ...l, ...after, payments: [{ dueDate: "2026-11-05", amount: 10000, paidOn: TODAY }] },
      TODAY,
    );
    expect(v.state.balance).toBe(after.outstanding);
    expect(v.next?.date).toBe("2026-12-05");
  });

  it("adds up what's owed, the EMIs and the debt-free date", () => {
    const t = loanTotals([loanView(loan(), TODAY), loanView(loan({ id: "l2", outstanding: 50000, emi: 5000 }), TODAY)]);
    expect(t.owed).toBe(250000);
    expect(t.monthlyEmi).toBe(15000);
    expect(t.debtFree! > "2028-01-01").toBe(true);
    expect(t.openEnded).toBe(false);
  });
});
