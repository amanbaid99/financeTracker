import { describe, expect, it } from "vitest";
import {
  composeGuidedBudget,
  budgetSetupCosts,
  costTotal,
  guideCosts,
  recommendBudget,
  personalBudget,
} from "@/lib/budget-guide";
import {
  applyBudgetRules,
  budgetSheetSchema,
  emptyBudgetSheet,
  readBudgetSheet,
  rowAmount,
  sheetTotals,
  type BudgetSheetRow,
} from "@/lib/budget-sheet";
const row = (
  id: string,
  category: BudgetSheetRow["category"],
  value: number,
): BudgetSheetRow => ({
  id,
  name: id,
  category,
  mode: "amount",
  value,
  loanId: null,
});

describe("budget setup", () => {
  it("imports fixed costs and EMIs without auto-adding transport or day-to-day spending", () => {
    const items = guideCosts(
      emptyBudgetSheet(100000),
      [
        { id: "rent", name: "Rent", amount: 30000 },
        { id: "groceries", name: "Groceries", amount: 8000 },
        { id: "daily", name: "Day-to-day spending", amount: 5000 },
        { id: "transport", name: "Transport", amount: 4000 },
      ],
      [
        {
          id: "00000000-0000-4000-8000-000000000090",
          name: "Car loan",
          emi: 5000,
        },
      ],
    );
    expect(items.map((i) => [i.row.name, i.row.category, i.row.value])).toEqual(
      [
        ["Rent", "fixed", 30000],
        ["Groceries", "fixed", 8000],
        ["Car loan EMI", "fixed", 5000],
      ],
    );
  });

  it("keeps saving and investing rows out of the costs list", () => {
    const plan = {
      ...emptyBudgetSheet(100000),
      rows: [row("Rent", "fixed", 30000), row("SIP", "investing", 20000)],
    };
    expect(guideCosts(plan, [], []).map((i) => i.row.name)).toEqual(["Rent"]);
  });

  it("rounds Save & invest down to ₹500 and gives the rest to Personal spending", () => {
    const r = recommendBudget(150000, [row("Rent", "fixed", 40913)]);
    expect(r.future % 500).toBe(0);
    expect(r.future + r.personal + r.essentials).toBe(150000);
    const p = composeGuidedBudget(
      150000,
      [row("Rent", "fixed", 40913)],
      [],
      r.future,
    );
    expect(sheetTotals(p).remaining).toBe(0);
    expect(budgetSheetSchema.safeParse(p).success).toBe(true);
  });

  it("counts existing SIPs inside Save & invest instead of on top", () => {
    const rows = [row("Costs", "fixed", 90000)];
    // Without SIPs a small amount; with ₹8,000 of SIPs it covers them.
    expect(recommendBudget(100000, rows).future).toBe(5000);
    expect(recommendBudget(100000, rows, 8000).future).toBe(8000);
    expect(recommendBudget(100000, rows, 50000).future).toBe(10000);
  });

  it("counts named personal costs within Personal spending, never twice", () => {
    const costs = [
      row("Rent", "fixed", 50000),
      row("Day-to-day spending", "personal", 30000),
    ];
    const r = recommendBudget(100000, costs);
    expect(r.personal).toBeGreaterThanOrEqual(30000);
    const plan = composeGuidedBudget(100000, costs, [], r.future);
    expect(sheetTotals(plan).remaining).toBe(0);
  });

  it("never invents money when costs exceed income", () => {
    const rows = [row("Costs", "fixed", 110000)];
    expect(recommendBudget(100000, rows)).toMatchObject({
      future: 0,
      personal: 0,
      shortfall: 10000,
    });
  });

  it("saves a budget with no salary as just monthly costs", () => {
    const rows = [
      row("Rent", "fixed", 30000),
      row("Day-to-day spending", "personal", 15000),
    ];
    const p = composeGuidedBudget(0, rows, [], 0, true);
    expect(p.noSalary).toBe(true);
    expect(budgetSheetSchema.safeParse(p).success).toBe(true);
    expect(p.rows.some((r) => r.category === "savings")).toBe(false);
    expect(costTotal(p.rows, 0)).toBe(45000);
    expect(
      budgetSheetSchema.safeParse({ ...p, noSalary: undefined }).success,
    ).toBe(false);
  });

  it("remembers excluded loans and drops a closed loan's EMI on read", () => {
    const id = "00000000-0000-4000-8000-000000000090";
    const p = composeGuidedBudget(
      100000,
      [],
      [{ id, name: "Loan", emi: 5000 }],
      30000,
    );
    expect(p.excludedLoanIds).toEqual([id]);
    expect(
      readBudgetSheet(p, 100000, [{ id, name: "Loan", emi: 5000 }]),
    ).toEqual(p);
    const withLoan = composeGuidedBudget(
      100000,
      [
        {
          id: "emi",
          name: "Loan EMI",
          category: "fixed",
          mode: "amount",
          value: 10000,
          loanId: id,
        },
      ],
      [],
      30000,
    );
    expect(
      readBudgetSheet(withLoan, 100000, [])!.rows.some((r) => r.loanId === id),
    ).toBe(false);
  });

  it("gives a removed cost to Personal spending, keeping Save & invest", () => {
    const p = composeGuidedBudget(
      100000,
      [row("Rent", "fixed", 50000)],
      [],
      30000,
    );
    const next = applyBudgetRules({
      ...p,
      rows: p.rows.filter((r) => r.id !== "Rent"),
    });
    expect(next.rows.find((r) => r.id === "rule-personal")?.value).toBe(70000);
    expect(
      rowAmount(next.rows.find((r) => r.id === "rule-savings")!, 100000),
    ).toBe(30000);
  });
});

it("personal spending is the user's choice and saving is the exact remainder",()=>{
 const rows=[row("rent","fixed",68015)];
 expect(personalBudget(170000,rows,40000)).toMatchObject({future:61985,valid:true});
 expect(personalBudget(170000,rows,50000)).toMatchObject({future:51985,valid:true});
 expect(personalBudget(170000,rows,110000).valid).toBe(false);
});
it("personal costs are included once and cannot silently be cut",()=>{
 const rows=[row("rent","fixed",40000),row("commute","personal",10000)];
 expect(personalBudget(100000,rows,20000)).toMatchObject({future:40000,valid:true});
 expect(personalBudget(100000,rows,5000).valid).toBe(false);
 expect(personalBudget(100000,[],0)).toMatchObject({future:100000,valid:true});
});

it("preserves personal expenses entered explicitly while skipping their old record defaults",()=>{
 const manual={...row("my-transport","personal",3500),name:"Transport"};
 const p={...emptyBudgetSheet(100000),rows:[manual]};
 const costs=[{id:"old-transport",name:"Transport",amount:5000},{id:"old-daily",name:"Day to day spending",amount:10000}];
 const result=guideCosts(p,costs,[]);
 expect(result.map(i=>i.row)).toEqual([manual]);
 expect(guideCosts(emptyBudgetSheet(100000),costs,[])).toEqual([]);
});

it("two-screen setup seeds blank rent and utilities while retaining known EMIs once",()=>{
 const loan={id:"00000000-0000-4000-8000-000000000001",name:"Loan",emi:10000};
 const items=budgetSetupCosts(emptyBudgetSheet(100000),[],[loan]);
 expect(items.map(i=>[i.row.name,i.row.value])).toEqual([["Loan EMI",10000],["Rent",0],["Utilities",0]]);
 expect(budgetSetupCosts(emptyBudgetSheet(100000),[{id:"rent",name:"Rent",amount:20000},{id:"utilities",name:"Utilities and phone",amount:5000}],[])).toHaveLength(2);
});
it("a saved no-salary personal total remains one editable aggregate",()=>{
 const saved=composeGuidedBudget(0,[{...row("setup-personal","personal",5000),name:"Personal spending"}],[],0,true);
 expect(budgetSetupCosts(saved,[],[]).some(i=>i.row.id==="setup-personal")).toBe(false);
});
