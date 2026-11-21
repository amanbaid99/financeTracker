// Works out which of your money covers which goal, so you never link
// investments by hand. Pure: callers pass goals tracked with no links (for
// what each needs) and today's investments. Nothing is saved.
//
// Order, like a waterfall:
//   1. The emergency fund, up to a third of its target (a safety floor).
//   2. Bills funds and goals due within a year, soonest first.
//   3. The rest of the emergency fund.
//   4. Every other goal in your plan order (must haves before nice to haves).
// Each goal only takes money that suits how far away it is: safe money for
// the next year, low risk for 1 to 3 years, some equity for 3 to 5, equity
// for longer. A goal more than a year away needs less today, because the
// money it takes can grow until then.

import { formatINR } from "./format";
import { planOrder } from "./goal-order";
import { defaultReturn } from "./instruments";
import { assetClassOf } from "./portfolio";
import type { Investment, Link, TrackedGoal } from "./tracker";

/** The kinds of money goals draw from. */
export type Pool =
  | "cash"
  | "debt"
  | "hybrid"
  | "equity"
  | "gold"
  | "retirement";

export const POOL_LABEL: Record<Pool, string> = {
  cash: "safe money",
  debt: "low-risk funds",
  hybrid: "hybrid funds",
  equity: "equity",
  gold: "gold",
  retirement: "retirement accounts",
};

/** Ready to use within days: savings, liquid and overnight funds, FDs. */
const CASH_CATEGORIES = new Set([
  "liquid_fund",
  "overnight_fund",
  "money_market",
  "arbitrage",
]);

export function poolOf(i: Investment): Pool | null {
  if (i.kind === "fd") return "cash";
  if (CASH_CATEGORIES.has(i.category ?? "")) return "cash";
  const cls = assetClassOf(i);
  if (cls === "other") return null;
  return cls;
}

/** Share of the emergency fund given before anything else. */
export const EMERGENCY_FLOOR_SHARE = 1 / 3;

/** Which money suits a goal, best first. */
export function poolsFor(goal: TrackedGoal): Pool[] {
  if (goal.type === "emergency_fund" || goal.type === "bills_fund")
    return ["cash", "debt"];
  const m = goal.months;
  if (goal.type === "loan_payoff" && m === null)
    return ["debt", "cash", "hybrid"];
  if (m !== null && m < 12) return ["cash", "debt"];
  if (m !== null && m < 36) return ["debt", "cash", "hybrid"];
  if (m !== null && m < 60) return ["hybrid", "debt", "equity", "gold"];
  return goal.type === "retirement"
    ? ["retirement", "equity", "hybrid", "gold", "debt"]
    : ["equity", "hybrid", "gold", "debt"];
}

/** What the goal still needs on its date (before growth). */
function needOf(goal: TrackedGoal): number {
  // A loan with no date: what closing it costs today.
  if (goal.loanState && goal.months === null) return Math.max(0, goal.target);
  // A dated loan the EMIs close first needs nothing.
  if (goal.loanState && goal.emisCloseFirst) return 0;
  if (goal.billsFund) return Math.max(0, goal.billsFund.needsToday);
  return Math.max(0, goal.futureTarget);
}

const returnOf = (i: Investment) =>
  i.returnPct ?? defaultReturn(i.kind, i.category);

/** How much ₹1 today grows to by the goal's date (1 within a year or with no date). */
function growth(goal: TrackedGoal, i: Investment): number {
  const m = goal.months;
  if (m === null || m < 12) return 1;
  return Math.pow(1 + returnOf(i) / 100, m / 12);
}

export interface GoalCover {
  goalId: string;
  /** Rupees taken from your money today. */
  taken: number;
  /** Still needed on the goal's date after growth, 0 when covered. */
  short: number;
  /** Rupees taken from each pool. */
  byPool: Partial<Record<Pool, number>>;
  /** One plain sentence on why it got this money. */
  why: string;
}

export interface AutoAllocation {
  links: Link[];
  covers: Record<string, GoalCover>;
  /** Money no goal needs right now, by pool. */
  spare: Partial<Record<Pool, number>>;
  spareTotal: number;
  /** Money that can't go to any goal (unknown kind). */
  unplaced: number;
}

interface Tranche {
  goal: TrackedGoal;
  /** Share of the goal's need this step may fill (0 to 1). */
  upTo: number;
  stage: "floor" | "soon" | "emergency" | "rest";
}

function tranches(goals: TrackedGoal[], today: string): Tranche[] {
  const live = goals.filter((g) => needOf(g) > 0);
  const emergency = live.filter((g) => g.type === "emergency_fund");
  const soon = live
    .filter(
      (g) =>
        g.type !== "emergency_fund" &&
        (g.type === "bills_fund" || (g.months !== null && g.months < 12)),
    )
    .sort((a, b) => (a.months ?? 0) - (b.months ?? 0));
  const taken = new Set([...emergency, ...soon].map((g) => g.id));
  const ordered = planOrder(
    live.filter((g) => !taken.has(g.id)),
    today,
  );
  const custom = goals.some((g) => g.planRank != null);
  const rest = custom
    ? ordered
    : [
        ...ordered.filter((g) => !g.niceToHave),
        ...ordered.filter((g) => g.niceToHave),
      ];
  return [
    ...emergency.map((goal) => ({
      goal,
      upTo: EMERGENCY_FLOOR_SHARE,
      stage: "floor" as const,
    })),
    ...soon.map((goal) => ({ goal, upTo: 1, stage: "soon" as const })),
    ...emergency.map((goal) => ({
      goal,
      upTo: 1,
      stage: "emergency" as const,
    })),
    ...rest.map((goal) => ({ goal, upTo: 1, stage: "rest" as const })),
  ];
}

const listPools = (pools: Pool[]) => {
  const names = pools.map((p) => POOL_LABEL[p]);
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

function explain(
  goal: TrackedGoal,
  cover: GoalCover,
  spare: Partial<Record<Pool, number>>,
): string {
  const used = (Object.keys(cover.byPool) as Pool[]).filter(
    (p) => (cover.byPool[p] ?? 0) > 0,
  );
  const why =
    goal.type === "emergency_fund"
      ? "It gets safe money first, up to a third of its target, then again after goals due this year."
      : goal.type === "bills_fund" || (goal.months !== null && goal.months < 12)
        ? "Due within a year, so it gets safe money early."
        : goal.months !== null && goal.months < 36
          ? "1 to 3 years away, so it uses low-risk money."
          : goal.months !== null && goal.months < 60
            ? "3 to 5 years away, so it can use some equity."
            : "Far away, so it uses equity, which can grow it.";
  if (cover.short <= 0) return `Covered by your ${listPools(used)}. ${why}`;
  const unsuitable = (Object.keys(spare) as Pool[]).filter(
    (p) => (spare[p] ?? 0) > 0 && !poolsFor(goal).includes(p),
  );
  const shortText =
    cover.taken > 0
      ? `Gets ${formatINR(cover.taken)} from your ${listPools(used)}, ${formatINR(cover.short)} short.`
      : `Nothing to give it yet, ${formatINR(cover.short)} short.`;
  const hint = unsuitable.length
    ? ` Your spare ${listPools(unsuitable)} isn't used, because it doesn't suit this timeline.`
    : "";
  return `${shortText} ${why}${hint}`;
}

/** Splits your money across goals. `goals` are tracked with no links. */
export function autoAllocate(
  goals: TrackedGoal[],
  investments: Investment[],
  today: string,
): AutoAllocation {
  // Rupees left in each investment, and a running amount per goal and investment.
  const left = new Map(investments.map((i) => [i.id, Math.max(0, i.value)]));
  const byPool = new Map<Pool, Investment[]>();
  let unplaced = 0;
  for (const i of investments) {
    const p = poolOf(i);
    if (!p) {
      unplaced += Math.max(0, i.value);
      continue;
    }
    byPool.set(p, [...(byPool.get(p) ?? []), i]);
  }
  // Bigger holdings first, so each goal uses as few as it can.
  for (const list of byPool.values()) list.sort((a, b) => b.value - a.value);

  const amounts = new Map<string, number>(); // `${goal}|${inv}` -> rupees
  const remaining = new Map(goals.map((g) => [g.id, needOf(g)])); // on the goal's date
  const covers: Record<string, GoalCover> = {};
  for (const g of goals)
    covers[g.id] = { goalId: g.id, taken: 0, short: 0, byPool: {}, why: "" };

  for (const t of tranches(goals, today)) {
    const g = t.goal;
    const full = needOf(g);
    // In a floor step, fill only up to that share of the whole need.
    let want = Math.max(0, (remaining.get(g.id) ?? 0) - full * (1 - t.upTo));
    for (const pool of poolsFor(g)) {
      for (const i of byPool.get(pool) ?? []) {
        if (want <= 0) break;
        const have = left.get(i.id) ?? 0;
        if (have <= 0) continue;
        const grow = growth(g, i);
        const take = Math.min(have, Math.ceil(want / grow));
        left.set(i.id, have - take);
        const key = `${g.id}|${i.id}`;
        amounts.set(key, (amounts.get(key) ?? 0) + take);
        const c = covers[g.id];
        c.taken += take;
        c.byPool[pool] = (c.byPool[pool] ?? 0) + take;
        const reduce = Math.min(want, take * grow);
        want -= reduce;
        remaining.set(g.id, Math.max(0, (remaining.get(g.id) ?? 0) - reduce));
      }
    }
  }

  const links: Link[] = [];
  for (const [key, rupees] of amounts) {
    const [goalId, investmentId] = key.split("|");
    const inv = investments.find((i) => i.id === investmentId)!;
    if (rupees > 0 && inv.value > 0)
      links.push({
        goalId,
        investmentId,
        percent: Math.min(100, (rupees / inv.value) * 100),
      });
  }

  // A new SIP with nothing in it yet goes to the first goal it suits that still needs money.
  const order = tranches(goals, today).map((t) => t.goal);
  for (const i of investments) {
    if (i.value > 0 || i.monthlySip <= 0) continue;
    const p = poolOf(i);
    if (!p) continue;
    const g =
      order.find(
        (x) => poolsFor(x).includes(p) && (remaining.get(x.id) ?? 0) > 0,
      ) ?? order.find((x) => poolsFor(x).includes(p));
    if (g) links.push({ goalId: g.id, investmentId: i.id, percent: 100 });
  }

  const spare: Partial<Record<Pool, number>> = {};
  for (const i of investments) {
    const p = poolOf(i);
    const l = left.get(i.id) ?? 0;
    if (p && l > 0) spare[p] = (spare[p] ?? 0) + l;
  }
  for (const g of goals) {
    const c = covers[g.id];
    c.short = Math.round(remaining.get(g.id) ?? 0);
    if (c.short < 1) c.short = 0;
    c.why = needOf(g) > 0 ? explain(g, c, spare) : "";
  }
  return {
    links,
    covers,
    spare,
    spareTotal: Object.values(spare).reduce((s, v) => s + (v ?? 0), 0),
    unplaced,
  };
}
