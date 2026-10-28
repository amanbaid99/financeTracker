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
  { ...inv("goldetf", "stock", "direct_equity", 6047, 8), name: "Gold etf" },
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
      Marriage: ["Gold etf", true], // arb (liquid, in place of short debt) plus up to a fifth in gold
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

describe("smart split", () => {
  const f = (id: string, category: string, value = 10000, sip = 0, kind = "mutual_fund"): Investment => ({
    id,
    kind,
    name: id,
    category,
    value,
    monthlySip: sip,
    returnPct: null,
  });
  const linkAll = (goalId: string, ids: string[], percent = 100): Link[] =>
    ids.map((investmentId) => ({ goalId, investmentId, percent }));

  it("spreads a long-term goal across different kinds of equity fund, weighted by fit", async () => {
    const { splitForGoal } = await import("@/lib/sip-plan");
    const funds = [f("index", "equity_index"), f("flexi", "flexi_cap"), f("mid", "mid_small_cap")];
    const out = splitForGoal("g", "equity_index", 12000, 0, funds, linkAll("g", ["index", "flexi", "mid"]));
    // 3 : 2 : 1 parts of ₹12,000.
    expect(out.map((s) => [s.investment.id, s.monthly])).toEqual([
      ["index", 6000],
      ["flexi", 4000],
      ["mid", 2000],
    ]);
  });

  it("keeps one fund per kind, so two index funds aren't counted as spreading", async () => {
    const { splitForGoal } = await import("@/lib/sip-plan");
    const funds = [f("idx1", "equity_index", 5000), f("idx2", "equity_index", 50000), f("flexi", "flexi_cap")];
    const out = splitForGoal("g", "equity_index", 10000, 0, funds, linkAll("g", ["idx1", "idx2", "flexi"]));
    expect(out.map((s) => s.investment.id)).toEqual(["idx2", "flexi"]);
    expect(out.reduce((a, s) => a + s.monthly, 0)).toBe(10000);
  });

  it("skips funds that don't suit the timeline and savings accounts when a fund will do", async () => {
    const { splitForGoal } = await import("@/lib/sip-plan");
    const funds = [f("liq", "liquid_fund"), f("arb", "arbitrage"), f("elss", "elss"), f("bank", "savings_account", 50000, 0, "savings")];
    const out = splitForGoal("g", "liquid_fund", 9000, 0, funds, linkAll("g", ["liq", "arb", "elss", "bank"]));
    expect(out.map((s) => [s.investment.id, s.monthly])).toEqual([
      ["liq", 6500],
      ["arb", 2500],
    ]);
  });

  it("prefers funds only this goal uses over shared ones", async () => {
    const { splitForGoal } = await import("@/lib/sip-plan");
    const funds = [f("own", "liquid_fund"), f("shared", "overnight_fund")];
    const links = [...linkAll("g", ["own"]), ...linkAll("g", ["shared"], 60), ...linkAll("other", ["shared"], 40)];
    expect(splitForGoal("g", "liquid_fund", 6000, 0, funds, links).map((s) => s.investment.id)).toEqual(["own"]);
  });

  it("small amounts stay in one fund; lump sums split in ₹1,000 steps", async () => {
    const { splitForGoal } = await import("@/lib/sip-plan");
    const funds = [f("index", "equity_index"), f("flexi", "flexi_cap")];
    const links = linkAll("g", ["index", "flexi"]);
    expect(splitForGoal("g", "equity_index", 800, 0, funds, links)).toHaveLength(1);
    const lump = splitForGoal("g", "equity_index", 0, 50000, funds, links);
    expect(lump.map((s) => s.lump)).toEqual([30000, 20000]);
  });

  it("counts a gold ETF, held to a fifth of the goal", async () => {
    const { splitForGoal } = await import("@/lib/sip-plan");
    // Marriage: an arbitrage-like liquid fund plus your gold ETF.
    const out = splitForGoal("mar", "short_debt_fund", 10000, 0, investments, links);
    expect(out.map((s) => [s.investment.name, s.monthly])).toEqual([
      ["arb", 8000],
      ["Gold etf", 2000],
    ]);
    expect(out[1].note).toMatch(/^gold/);
  });

  it("an ETF takes small amounts, from ₹100", async () => {
    const { splitForGoal } = await import("@/lib/sip-plan");
    const etf = { ...f("nifty", "direct_equity", 5000, 0, "stock"), name: "Nifty 50 ETF" };
    const funds = [f("flexi", "flexi_cap"), etf];
    const out = splitForGoal("g", "equity_index", 700, 0, funds, linkAll("g", ["flexi", "nifty"]));
    // The fund needs its ₹500 minimum; the ETF takes the rest.
    expect(out.map((s) => [s.investment.id, s.monthly])).toEqual([
      ["nifty", 200],
      ["flexi", 500],
    ]);
  });

  it("leaves gold out of money needed any day", async () => {
    const { splitForGoal } = await import("@/lib/sip-plan");
    const gold = { ...f("g1", "direct_equity", 5000, 0, "stock"), name: "Gold ETF" };
    const out = splitForGoal("g", "liquid_fund", 6000, 0, [f("liq", "liquid_fund"), gold], linkAll("g", ["liq", "g1"]));
    expect(out.map((s) => s.investment.id)).toEqual(["liq"]);
  });

  it("the SIP plan lists each fund's share under its goal", async () => {
    const { sipPlan } = await import("@/lib/sip-plan");
    const plan = planMoney({ goals: tracked, investments, links, lump: 0, monthlyTotal: 65000, todayISO: TODAY });
    const sips = sipPlan(plan.suggestions, investments, links);
    expect(sips.reduce((s, l) => s + l.monthly, 0)).toBe(65000);
  });
});
