import { describe, expect, it } from "vitest";
import { updatesDue } from "@/lib/updates";
import { loanState } from "@/lib/loan";
import type { Card } from "@/lib/cards";
import type { Loan } from "@/lib/loans";

const card: Card = {
  id: "c",
  label: "My card",
  annualFee: null,
  statementDay: 20,
  yearStart: null,
  rewards: null,
  benefits: [],
  bestFor: [],
  milestones: [],
  bills: [],
};
const loan: Loan = {
  id: "l",
  name: "My loan",
  type: "personal",
  cardId: null,
  principal: 100000,
  takenOn: null,
  ratePct: 9,
  emi: 5000,
  monthsLeft: null,
  totalEmis: null,
  emiDay: 10,
  billDay: null,
  firstEmi: null,
  outstanding: 80000,
  asOf: "2026-10-01",
  foreclosurePct: null,
  foreclosureGst: false,
  payments: [],
  goal: null,
};
const base = {
  today: "2026-11-16",
  cards: [] as Card[],
  loans: [] as Loan[],
  lastCas: null,
  hasFunds: false,
};

describe("updates due", () => {
  it("targets the latest generated statement, including month-end and year rollover", () => {
    expect(updatesDue({ ...base, cards: [card] })[0].key).toBe(
      "statement:c:2026-10-01",
    );
    const onDay = updatesDue({
      ...base,
      today: "2026-11-20",
      cards: [card],
    })[0];
    expect(onDay.key).toBe("statement:c:2026-11-01");
    expect(decodeURIComponent(onDay.href)).toContain("bill:c:2026-11");
    expect(
      updatesDue({ ...base, today: "2027-01-01", cards: [card] })[0].key,
    ).toBe("statement:c:2026-12-01");
    expect(
      updatesDue({
        ...base,
        today: "2027-02-28",
        cards: [{ ...card, statementDay: 31 }],
      })[0].key,
    ).toBe("statement:c:2027-02-01");
  });
  it("clears on logging the requested month, ignoring legacy payment flags", () => {
    const logged = {
      ...card,
      bills: [
        {
          id: "b",
          month: "2026-10-01",
          amount: 0,
          paid: false,
          dueDate: "2026-10-22",
          note: null,
        },
      ],
    };
    expect(updatesDue({ ...base, cards: [logged] })).toEqual([]);
    expect(
      updatesDue({ ...base, cards: [{ ...card, statementDay: null }] }),
    ).toEqual([]);
  });
  it("offers loan reviews three months after the last known balance",()=>{
    expect(updatesDue({...base,today:"2026-12-31",loans:[loan]})).toEqual([]);
    const review=updatesDue({...base,today:"2027-01-01",loans:[loan]})[0];
    expect(review.key).toBe("loan:l:2027-01-01");expect(review.optional).toBe(true);
    expect(updatesDue({...base,today:"2027-01-01",loans:[{...loan,confirmedOn:"2026-12-20"}]})).toEqual([]);
    expect(updatesDue({...base,today:"2027-01-01",loans:[{...loan,outstanding:0}]})).toEqual([]);
  });
  it("CAS review is optional and quarterly, not every new month",()=>{
    expect(updatesDue({...base,hasFunds:true,today:"2027-01-04",lastCas:"2026-10-05T10:00:00Z"})).toEqual([]);
    const review=updatesDue({...base,hasFunds:true,today:"2027-01-05",lastCas:"2026-10-05T10:00:00Z"})[0];
    expect(review.key).toBe("cas:2027-01-05");expect(review.optional).toBe(true);
    expect(updatesDue({...base,hasFunds:false})).toEqual([]);
  });
  it("review keys remain stable across month boundaries",()=>{
    const opts={...base,loans:[loan],hasFunds:true,lastCas:"2026-10-05T10:00:00Z"};
    expect(updatesDue({...opts,today:"2027-01-31"}).map(i=>i.key)).toEqual(updatesDue({...opts,today:"2027-02-01"}).map(i=>i.key));
  });
  it("uses IST dates for quarterly CAS review",()=>{
    expect(updatesDue({...base,hasFunds:true,today:"2027-02-28",lastCas:"2026-11-30T18:40:00Z"})).toEqual([]);
    expect(updatesDue({...base,hasFunds:true,today:"2027-03-01",lastCas:"2026-11-30T18:40:00Z"})).toHaveLength(1);
  });
  it("snoozes optional reviews across month boundaries and restores them on the chosen day",()=>{
    const opts={...base,hasFunds:true,snoozes:{"cas:initial":"2026-12-06"}};
    expect(updatesDue({...opts,today:"2026-12-05"})).toEqual([]);
    expect(updatesDue({...opts,today:"2026-12-06"})).toHaveLength(1);
  });
  it("keeps confirmed balances fixed across missed monthly updates, while retaining schedule estimates", () => {
    const input = {
      outstanding: 80000,
      ratePct: 9,
      emi: 5000,
      monthsLeft: null,
      asOf: "2026-10-01",
      emiDay: 10,
    };
    expect(loanState({ ...input, confirmed: true }, "2027-02-20").balance).toBe(
      80000,
    );
    expect(loanState(input, "2027-02-20").balance).toBeLessThan(80000);
    expect(
      loanState({ ...input, confirmed: true, outstanding: 0 }, base.today)
        .nextEmi,
    ).toBeNull();
  });
});
