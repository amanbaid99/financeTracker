import { describe, expect, it } from "vitest";
import { budgetSheetSchema } from "@/lib/budget-sheet";
import {
  equalSplit,
  sipMix,
  scaleSips,
  sipStatus,
  sipEditComparison,
  includedSipRows,
  sipsByGoal,
  sipTotal,
  type SipRow,
} from "@/lib/budget-sips";

const G1 = "00000000-0000-4000-8000-000000000001";
const G2 = "00000000-0000-4000-8000-000000000002";
const row = (
  id: string,
  amount: number,
  goalId: string | null = G1,
  locked = false,
): SipRow => ({
  id,
  investmentId: null,
  label: id,
  amount,
  goalId,
  ...(locked ? { locked } : {}),
});

describe("scaleSips", () => {
  it("scales unlocked rows in proportion and keeps locked ones", () => {
    const out = scaleSips(
      [row("a", 30000), row("b", 10000), row("nps", 500, G2, true)],
      60500,
    );
    expect(out.find((r) => r.id === "nps")!.amount).toBe(500);
    expect(out.find((r) => r.id === "a")!.amount).toBe(45000);
    expect(out.find((r) => r.id === "b")!.amount).toBe(15000);
    expect(sipTotal(out)).toBe(60500);
  });

  it("adds up exactly after rounding", () => {
    const out = scaleSips([row("a", 1), row("b", 1), row("c", 1)], 10000);
    expect(sipTotal(out)).toBe(10000);
  });

  it("drops unlocked rows to zero when locked ones use it all", () => {
    const out = scaleSips([row("a", 5000), row("lock", 8000, G2, true)], 6000);
    expect(out.map((r) => r.amount)).toEqual([0, 8000]);
  });
});

describe("sipStatus and sipsByGoal", () => {
  it("says what's left or over", () => {
    expect(sipStatus([row("a", 40000)], 50000)).toEqual({
      assigned: 40000,
      left: 10000,
      over: 0,
    });
    expect(sipStatus([row("a", 60000)], 50000).over).toBe(10000);
  });
  it("totals amounts per goal", () => {
    expect(
      sipsByGoal([
        row("a", 1000),
        row("b", 2000),
        row("c", 500, G2),
        row("d", 300, null),
      ]),
    ).toEqual(
      new Map([
        [G1, 3000],
        [G2, 500],
      ]),
    );
  });
});

it("saves SIP rows inside the budget", () => {
  const plan = {
    version: 2 as const,
    salary: 100000,
    rows: [],
    excludedLoanIds: [],
    sips: [row("a", 5000)],
  };
  expect(budgetSheetSchema.parse(plan).sips).toHaveLength(1);
  expect(
    budgetSheetSchema.safeParse({
      ...plan,
      sips: [{ ...row("a", 5000), label: "" }],
    }).success,
  ).toBe(false);
});

describe("equalSplit", () => {
  it("splits a goal's amount equally across its funds, adding up exactly", () => {
    expect(equalSplit(12000, 2)).toEqual([6000, 6000]);
    expect(equalSplit(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(equalSplit(500, 1)).toEqual([500]);
    expect(equalSplit(0, 2)).toEqual([]);
    expect(equalSplit(1000, 0)).toEqual([]);
  });
});

describe("sipMix", () => {
  it("adds up each goal's equal split by asset type", () => {
    const mix = sipMix([
      { amount: 10000, classes: ["equity", "gold"] },
      { amount: 6000, classes: ["equity"] },
      { amount: 4000, classes: [] },
      { amount: 0, classes: ["debt"] },
    ]);
    expect(mix).toEqual([
      { key: "equity", value: 11000, share: 0.55 },
      { key: "gold", value: 5000, share: 0.25 },
      { key: "none", value: 4000, share: 0.2 },
    ]);
    expect(sipMix([])).toEqual([]);
  });
});

it("shows live editing differences against the budget or clearly labelled saved SIP envelope",()=>{
 const saved=[row("a",71000)];
 expect(sipEditComparison([row("a",52550)],null,saved)).toMatchObject({assigned:52550,limit:71000,left:18450,over:0,source:"saved_plan"});
 expect(sipEditComparison([row("a",75000)],71000,saved)).toMatchObject({left:0,over:4000,source:"budget"});
 expect(sipEditComparison([row("a",71000)],null,saved)).toMatchObject({left:0,over:0});
 expect(sipEditComparison([row("a",1000)],0,saved)).toMatchObject({limit:0,over:1000,source:"budget"});
 expect(sipEditComparison([],null,[])).toMatchObject({limit:null,source:null,over:0,left:0});
});

it("keeps parked SIP rows saved but excludes them from goal contributions",()=>{
 const rows=[row("a",20000)];
 expect(includedSipRows({sips:rows,sipsIncluded:false})).toEqual([]);
 expect(includedSipRows({sips:rows,sipsIncluded:true})).toBe(rows);
 expect(includedSipRows({sips:rows})).toBe(rows);
 expect(rows[0].amount).toBe(20000);
});
