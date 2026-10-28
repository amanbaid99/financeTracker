// A real goal list (names changed) run through the tracker and money plan,
// to catch numbers that look wrong on screen.
import { describe, expect, it } from "vitest";
import { planMoney } from "@/lib/allocate";
import { goalHeadline } from "@/lib/goal-summary";
import {
  trackGoal,
  type GoalInput,
  type Investment,
  type Link,
} from "@/lib/tracker";

const TODAY = "2026-10-28";
const inv = (
  id: string,
  kind: string,
  category: string | null,
  value: number,
  returnPct: number | null = null,
): Investment => ({
  id,
  kind,
  name: id,
  category,
  value,
  monthlySip: 0,
  returnPct,
});
const investments: Investment[] = [
  inv("nps", "nps", "nps", 12000),
  inv("epf", "epf", "epf_vpf", 200000),
  inv("n50", "mutual_fund", "equity_index", 2603),
  inv("elss", "mutual_fund", "elss", 20614),
  inv("goldetf", "stock", "direct_equity", 6047, 8),
  inv("arb", "mutual_fund", "liquid_fund", 5009),
  inv("us", "stock", "direct_equity", 47000),
  inv("flexi", "mutual_fund", "flexi_cap", 2457),
  inv("mid", "mutual_fund", "mid_small_cap", 2378),
  inv("axis", "mutual_fund", "liquid_fund", 5000),
  inv("au", "savings", "savings_account", 8900),
  inv("abliq", "mutual_fund", "liquid_fund", 5000),
  inv("dsp1", "mutual_fund", "liquid_fund", 10000),
  inv("post", "savings", "savings_account", 70000),
  inv("dsp2", "mutual_fund", "liquid_fund", 128000),
];
const L = (goalId: string, ...ids: string[]): Link[] =>
  ids.map((investmentId) => ({ goalId, investmentId, percent: 100 }));
const links: Link[] = [
  ...L("ret", "nps", "epf", "n50"),
  ...L("mar", "elss", "goldetf", "arb"),
  ...L("hdp", "us", "flexi", "mid"),
  ...L("ef1", "axis"),
  ...L("trv", "au"),
  ...L("idfc", "abliq"),
  ...L("sink", "dsp1"),
  ...L("ef2", "post"),
  ...L("job", "dsp2"),
];
const loan = (outstanding: number, emi: number, ratePct: number) => ({
  outstanding,
  emi,
  ratePct,
  monthsLeft: null,
  asOf: "2026-10-26",
});
const once = (name: string, amount: number, nextDue: string) => ({
  name,
  amount,
  everyMonths: 0,
  nextDue,
});
const yearly = (name: string, amount: number, nextDue: string) => ({
  name,
  amount,
  everyMonths: 12,
  nextDue,
});
const goals: GoalInput[] = [
  {
    id: "ret",
    name: "Retirement",
    type: "retirement",
    target: 10000000,
    targetDate: "2060-12-31",
    inflationPct: 6,
  },
  {
    id: "mar",
    name: "Marriage",
    type: "wedding",
    target: 500000,
    targetDate: "2028-02-25",
    inflationPct: 6,
  },
  {
    id: "hdp",
    name: "House down payment",
    type: "house_down_payment",
    target: 2000000,
    targetDate: "2045-12-31",
    inflationPct: 6,
  },
  {
    id: "ef1",
    name: "Emergency fund",
    type: "emergency_fund",
    target: 300000,
    targetDate: "2027-12-31",
    inflationPct: null,
  },
  {
    id: "trv",
    name: "Travel",
    type: "custom",
    target: 50000,
    targetDate: "2027-06-30",
    inflationPct: null,
  },
  {
    id: "idfc",
    name: "IDFC loan",
    type: "loan_payoff",
    target: 153650,
    targetDate: null,
    inflationPct: null,
    loan: loan(153650, 13711, 11.99),
  },
  {
    id: "hdfc1",
    name: "HDFC 1",
    type: "loan_payoff",
    target: 184557,
    targetDate: null,
    inflationPct: null,
    loan: loan(184557, 5102, 11.88),
  },
  {
    id: "hdfc2",
    name: "HDFC 2",
    type: "loan_payoff",
    target: 331762,
    targetDate: null,
    inflationPct: null,
    loan: loan(331762, 9913, 10.8),
  },
  {
    id: "sink",
    name: "Sinking fund",
    type: "bills_fund",
    target: 110000,
    targetDate: null,
    inflationPct: null,
    bills: [
      yearly("My Health insurance", 15000, "2027-02-01"),
      yearly("Gym", 20000, "2027-03-01"),
      yearly("Moms health insurance", 25000, "2027-03-01"),
      yearly("Dads health insurance", 20000, "2027-09-01"),
      yearly("My Term insurance", 30000, "2027-10-01"),
    ],
  },
  {
    id: "ef2",
    name: "Emergency fund 2",
    type: "emergency_fund",
    target: 400000,
    targetDate: null,
    inflationPct: null,
  },
  {
    id: "house",
    name: "House",
    type: "house_down_payment",
    target: 2000000,
    targetDate: "2030-12-31",
    inflationPct: 6,
  },
  {
    id: "job",
    name: "JOB transition",
    type: "bills_fund",
    target: 137452,
    targetDate: null,
    inflationPct: null,
    bills: [
      once("Dec expenses", 25000, "2026-12-01"),
      once("IDFC emi 2", 13711, "2026-12-03"),
      once("HDFC emi 2", 15015, "2026-12-15"),
      once("Jan expenses", 25000, "2027-01-01"),
      once("Fnf", 30000, "2027-01-01"),
      once("IDFC emi 3", 13711, "2027-01-03"),
      once("HDFC emi 3", 15015, "2027-01-15"),
    ],
  },
];
const tracked = goals.map((g) => trackGoal(g, investments, links, TODAY));
const byId = (id: string) => tracked.find((g) => g.id === id)!;

describe("real goal list", () => {
  it("a bills fund that's nearly full asks only for what's missing", () => {
    const job = byId("job");
    expect(job.billsFund).toMatchObject({
      topUpNow: 9452,
      needsToday: 137452,
      monthlyNeed: 3151,
    });
    expect(goalHeadline(job).text).toBe("Needs ₹3,151 more a month");
    expect(job.progress).toBeCloseTo(128000 / 137452);
  });

  it("repeating bills need at least their steady monthly amount", () => {
    const sink = byId("sink");
    expect(sink.billsFund?.monthlyNeed).toBe(10000);
    expect(goalHeadline(sink).text).toBe("Needs ₹10,000 more a month");
  });

  it("the money plan doesn't pour everything into the bills fund", () => {
    const plan = planMoney({
      goals: tracked,
      investments,
      links,
      lump: 0,
      monthlyTotal: 65000,
      todayISO: TODAY,
    });
    const job = plan.suggestions.find((s) => s.goalId === "job")!;
    expect(job.monthly).toBe(3500);
    // The rest reaches the dated goals, soonest first.
    expect(
      plan.suggestions.find((s) => s.goalId === "trv")?.monthly,
    ).toBeGreaterThan(0);
    expect(
      plan.suggestions.find((s) => s.goalId === "ef1")?.monthly,
    ).toBeGreaterThan(0);
    expect(goalHeadline(job.after).text).toMatch(/^Next: .* covered$/);
  });

  it("loans whose EMIs close them first ask for nothing", () => {
    expect(goalHeadline(byId("idfc")).text).toBe("EMIs close it in Oct 2027");
    expect(byId("hdfc1").extraSipNeeded).toBe(0);
  });
});

describe("SIP plan", () => {
  it("puts each goal's SIP into a fund you already hold where one suits it", async () => {
    const { sipPlan } = await import("@/lib/sip-plan");
    const plan = planMoney({
      goals: tracked,
      investments,
      links,
      lump: 0,
      monthlyTotal: 65000,
      todayISO: TODAY,
    });
    const sips = sipPlan(plan.suggestions, investments, links);
    expect(sips.reduce((s, l) => s + l.monthly, 0)).toBe(65000);
    const where = Object.fromEntries(
      sips.flatMap((l) =>
        l.parts.map((p) => [p.goalName, [l.label, l.similar]]),
      ),
    );
    expect(where).toEqual({
      "JOB transition": ["dsp2", false], // the liquid fund already saving for it
      "Sinking fund": ["dsp1", false],
      Travel: ["au", true], // its savings account
      "Emergency fund": ["axis", false],
      Marriage: ["arb", true], // a liquid fund it already has, in place of short debt
    });
    expect(sips.every((l) => l.investment !== null)).toBe(true);
  });

  it("names a kind of fund only when you hold nothing suitable", async () => {
    const { sipPlan } = await import("@/lib/sip-plan");
    const plan = planMoney({
      goals: tracked,
      investments,
      links,
      lump: 0,
      monthlyTotal: 65000,
      todayISO: TODAY,
    });
    const sips = sipPlan(plan.suggestions, [], []);
    expect(sips.map((l) => l.label)).toContain("New liquid fund");
    expect(sips.every((l) => l.investment === null)).toBe(true);
  });

  it("uses a fund no goal uses yet before suggesting a new one", async () => {
    const { pickFund } = await import("@/lib/sip-plan");
    const spare = {
      ...investments[0],
      id: "spare",
      kind: "mutual_fund",
      category: "liquid_fund",
      name: "Spare liquid",
    };
    expect(
      pickFund("house", "liquid_fund", [...investments, spare], links)
        ?.investment.id,
    ).toBe("spare");
    // Funds already used by another goal aren't borrowed.
    expect(pickFund("house", "liquid_fund", investments, links)).toBeNull();
  });
});
