import { describe, expect, it } from "vitest";
import { debtOverview, afterPayment, loanTotals, loanView, type Loan } from "@/lib/loans";

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
  it("moves to the next EMI when this one was paid early", () => {
    const v = loanView(
      loan({
        payments: [
          { dueDate: "2026-11-05", amount: 10000, paidOn: "2026-10-20" },
        ],
      }),
      TODAY,
    );
    expect(v.next?.date).toBe("2026-12-05");
  });

  it("shows what's repaid against the amount withdrawn, and the next EMI", () => {
    const v = loanView(loan(), TODAY);
    expect(v.state.balance).toBe(200000);
    expect(v.repaid).toBe(100000);
    expect(v.progress).toBeCloseTo(1 / 3);
    expect(v.next).toMatchObject({
      date: "2026-11-05",
      amount: 10000,
      label: "due in 5 days",
    });
    expect(v.emisLine).toMatch(/of 36 scheduled EMIs elapsed$/);
  });

  it("asks about an EMI from the last week that isn't marked paid", () => {
    const v = loanView(loan({ asOf: "2026-09-27", emiDay: 28 }), TODAY);
    expect(v.next).toMatchObject({
      date: "2026-10-28",
      label: "overdue by 3 days",
      tone: "danger",
    });
  });

  it("marking an EMI paid takes it off and moves on to the next one", () => {
    const l = loan();
    const after = afterPayment(l, "2026-11-05");
    expect(after.asOf).toBe("2026-11-05");
    expect(after.outstanding).toBe(Math.round(200000 * 1.01 - 10000));
    const v = loanView(
      {
        ...l,
        ...after,
        payments: [{ dueDate: "2026-11-05", amount: 10000, paidOn: TODAY }],
      },
      TODAY,
    );
    expect(v.state.balance).toBe(after.outstanding);
    expect(v.next?.date).toBe("2026-12-05");
  });

  it("adds up what's owed, the EMIs and the debt-free date", () => {
    const t = loanTotals([
      loanView(loan(), TODAY),
      loanView(loan({ id: "l2", outstanding: 50000, emi: 5000 }), TODAY),
    ]);
    expect(t.owed).toBe(250000);
    expect(t.monthlyEmi).toBe(15000);
    expect(t.debtFree! > "2028-01-01").toBe(true);
    expect(t.openEnded).toBe(false);
  });
});

it("Home debt progress is an estimate and never changes confirmed balances",()=>{
 const l=loan({principal:100000,outstanding:80000,ratePct:0,emi:5000,asOf:"2026-01-01",confirmedOn:"2026-01-01",emiDay:10});
 const original=JSON.stringify(l);const d=debtOverview([l],"2026-03-11")!;
 expect(d.expected).toBe(65000);expect(d.recorded).toBe(80000);expect(d.progress).toBe(0.35);
 expect(JSON.stringify(l)).toBe(original);expect(loanView(l,"2026-03-11").state.balance).toBe(80000);
});
it("does not invent a debt percentage or payoff date with missing data",()=>{
 const d=debtOverview([loan({principal:null,emi:0,monthsLeft:null})],TODAY)!;
 expect(d.progress).toBeNull();expect(d.debtFree).toBeNull();expect(debtOverview([],TODAY)).toBeNull();
});
