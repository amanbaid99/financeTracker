// The money plan as SIPs to start. Each goal's monthly amount goes into a
// fund you already hold where one suits it: first one already saving for
// that goal, then one not yet used by any goal. Only when you hold nothing
// suitable does it name a kind of fund ("New liquid fund"). Your own funds
// are named; nothing new is ever named.

import type { Suggestion } from "./allocate";
import { categoryLabel } from "./categories";
import { asKind } from "./instruments";
import { freePercent, type Investment, type Link } from "./tracker";

export interface SipPart {
  goalId: string;
  goalName: string;
  monthly: number;
  /** Last month this part is needed (yyyy-mm-dd), or null to keep going. */
  until: string | null;
}

export interface SipLine {
  /** One of your investments, or null for a new fund of `category`. */
  investment: Investment | null;
  /** What to call it: your fund's name, or "New liquid fund". */
  label: string;
  /** The kind of fund the plan asked for. */
  category: string;
  /** Your fund isn't exactly that kind, but close enough. */
  similar: boolean;
  monthly: number;
  parts: SipPart[];
}

/** Kinds of fund that can stand in for the one the plan asks for, best first. */
const STAND_INS: Record<string, string[]> = {
  liquid_fund: [
    "liquid_fund",
    "overnight_fund",
    "ultra_short_debt",
    "arbitrage",
    "savings_account",
  ],
  short_debt_fund: [
    "short_debt_fund",
    "ultra_short_debt",
    "corporate_bond",
    "debt_fund",
    "arbitrage",
    "liquid_fund",
  ],
  balanced_advantage: [
    "balanced_advantage",
    "aggressive_hybrid",
    "multi_asset",
    "conservative_hybrid",
  ],
  equity_index: [
    "equity_index",
    "large_cap",
    "flexi_cap",
    "elss",
    "mid_small_cap",
    "international",
  ],
};

/** The kind of fund an investment is, for matching ("savings_account" for a bank account). */
function kindOf(i: Investment): string | null {
  const k = asKind(i.kind);
  if (k === "mutual_fund") return i.category;
  if (k === "savings") return "savings_account";
  return null; // stocks, FDs, PPF, EPF, NPS, gold: not something to SIP into here
}

/** How well `i` suits `category`: 0 exact, higher is looser, null not at all. */
function rank(i: Investment, category: string): number | null {
  const kind = kindOf(i);
  if (!kind) return null;
  const list = STAND_INS[category] ?? [category];
  const at = list.indexOf(kind);
  return at === -1 ? null : at;
}

/** When a goal's SIP can stop: its date, or its last one-time payment. */
function stopsAt(s: Suggestion): string | null {
  const g = s.after;
  if (g.billsFund) {
    const bills = g.billsFund.bills;
    if (bills.length && bills.every((b) => b.everyMonths === 0))
      return bills.reduce((a, b) => (b.due > a ? b.due : a), bills[0].due);
    return null;
  }
  return g.targetDate;
}

/** The fund to put a goal's SIP into: linked to it first, then one no goal uses. */
export function pickFund(
  goalId: string,
  category: string,
  investments: Investment[],
  links: Link[],
): { investment: Investment; similar: boolean } | null {
  const linked = new Set(
    links.filter((l) => l.goalId === goalId).map((l) => l.investmentId),
  );
  const best = (pool: Investment[]) =>
    pool
      .map((i) => ({ i, r: rank(i, category) }))
      .filter((x): x is { i: Investment; r: number } => x.r !== null)
      .sort(
        (a, b) =>
          a.r - b.r || b.i.monthlySip - a.i.monthlySip || b.i.value - a.i.value,
      )[0];
  const own = best(investments.filter((i) => linked.has(i.id)));
  const free = own
    ? null
    : best(
        investments.filter(
          (i) => !linked.has(i.id) && freePercent(i.id, links) >= 100,
        ),
      );
  const hit = own ?? free;
  return hit ? { investment: hit.i, similar: hit.r > 0 } : null;
}

export interface FundShare {
  investment: Investment;
  /** Monthly amount and lump sum for this fund. */
  monthly: number;
  lump: number;
  /** Not exactly the kind of fund asked for, but close enough. */
  similar: boolean;
  /** Share of this fund that counts toward the goal, %. */
  percent: number;
}

/** Exact match 3 parts, close stand-ins 2, looser ones 1. */
const weightOf = (r: number) => (r === 0 ? 3 : r <= 2 ? 2 : 1);

/** Splits `total` by `weights` in steps of `step`, at least one step each; the biggest share takes the rounding. */
function splitAmount(total: number, weights: number[], step: number): number[] {
  if (total <= 0) return weights.map(() => 0);
  const sum = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((w) =>
    Math.max(step, Math.round((total * w) / sum / step) * step),
  );
  const biggest = parts.indexOf(Math.max(...parts));
  parts[biggest] += total - parts.reduce((a, b) => a + b, 0);
  return parts;
}

/**
 * Where a goal's monthly amount (and lump sum) should go, spread across the
 * funds you already hold for it:
 * - only funds that suit the kind of fund the goal needs, one per kind, so
 *   it spreads across different funds rather than copies of one;
 * - funds that are only this goal's come before funds shared with others;
 * - a savings account only if no mutual fund suits;
 * - up to three funds, weighted by how well each fits (3, 2 or 1 parts),
 *   in steps of ₹500 a month with at least ₹500 each;
 * - small amounts (under ₹1,000 a month) go into the single best fund.
 * With none of the goal's own funds suitable, it uses one fund no goal uses
 * yet. Returns [] when nothing you hold suits.
 */
export function splitForGoal(
  goalId: string,
  category: string,
  monthly: number,
  lump: number,
  investments: Investment[],
  links: Link[],
): FundShare[] {
  const pctOf = new Map(
    links
      .filter((l) => l.goalId === goalId)
      .map((l) => [l.investmentId, l.percent]),
  );
  type Cand = { i: Investment; r: number; pct: number };
  const suitable = (
    pool: Investment[],
    pct: (i: Investment) => number,
  ): Cand[] =>
    pool
      .map((i) => ({ i, r: rank(i, category), pct: pct(i) }))
      .filter((c): c is Cand => c.r !== null);

  let cands = suitable(
    investments.filter((i) => pctOf.has(i.id)),
    (i) => pctOf.get(i.id)!,
  );
  // Funds only this goal uses come first; shared ones only if that's all there is.
  if (cands.some((c) => c.pct >= 100))
    cands = cands.filter((c) => c.pct >= 100);
  if (!cands.length) {
    const spare = suitable(
      investments.filter(
        (i) => !pctOf.has(i.id) && freePercent(i.id, links) >= 100,
      ),
      () => 100,
    ).sort(
      (a, b) =>
        a.r - b.r || b.i.monthlySip - a.i.monthlySip || b.i.value - a.i.value,
    )[0];
    return spare
      ? [
          {
            investment: spare.i,
            monthly,
            lump,
            similar: spare.r > 0,
            percent: 100,
          },
        ]
      : [];
  }
  // A savings account only when no fund suits.
  if (cands.some((c) => kindOf(c.i) !== "savings_account"))
    cands = cands.filter((c) => kindOf(c.i) !== "savings_account");
  // Best fit first, then the one already getting more, then the bigger one.
  cands.sort(
    (a, b) =>
      a.r - b.r || b.i.monthlySip - a.i.monthlySip || b.i.value - a.i.value,
  );
  // One fund per kind: two of the same kind isn't spreading the risk.
  const seen = new Set<string>();
  cands = cands.filter((c) => {
    const k = kindOf(c.i)!;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // Each fund gets at least ₹500 a month (or ₹1,000 of a lump sum), so
  // small amounts stay in one fund.
  const maxFunds = Math.min(
    3,
    Math.max(
      1,
      monthly > 0 ? Math.floor(monthly / 500) : Math.floor(lump / 1000),
    ),
  );
  cands = cands.slice(0, maxFunds);

  const weights = cands.map((c) => weightOf(c.r));
  const monthlies = splitAmount(monthly, weights, 500);
  const lumps = splitAmount(lump, weights, 1000);
  return cands.map((c, k) => ({
    investment: c.i,
    monthly: monthlies[k],
    lump: lumps[k],
    similar: c.r > 0,
    percent: c.pct,
  }));
}

export function sipPlan(
  suggestions: Suggestion[],
  investments: Investment[] = [],
  links: Link[] = [],
): SipLine[] {
  const lines = new Map<string, SipLine>();
  const add = (
    key: string,
    make: () => SipLine,
    s: Suggestion,
    monthly: number,
  ) => {
    const line = lines.get(key) ?? make();
    line.monthly += monthly;
    line.parts.push({
      goalId: s.goalId,
      goalName: s.goalName,
      monthly,
      until: stopsAt(s),
    });
    lines.set(key, line);
  };
  for (const s of suggestions) {
    if (s.monthly <= 0) continue;
    const shares = splitForGoal(
      s.goalId,
      s.category,
      s.monthly,
      0,
      investments,
      links,
    );
    if (!shares.length) {
      add(
        `new:${s.category}`,
        () => ({
          investment: null,
          label: `New ${categoryLabel(s.category).toLowerCase()}`,
          category: s.category,
          similar: false,
          monthly: 0,
          parts: [],
        }),
        s,
        s.monthly,
      );
      continue;
    }
    for (const sh of shares)
      add(
        `inv:${sh.investment.id}`,
        () => ({
          investment: sh.investment,
          label:
            sh.investment.name?.trim() || categoryLabel(kindOf(sh.investment)),
          category: s.category,
          similar: sh.similar,
          monthly: 0,
          parts: [],
        }),
        s,
        sh.monthly,
      );
  }
  for (const l of lines.values())
    l.parts.sort((a, b) =>
      (a.until ?? "9999").localeCompare(b.until ?? "9999"),
    );
  // Your own funds first, biggest first; new funds after.
  return [...lines.values()].sort(
    (a, b) =>
      Number(a.investment === null) - Number(b.investment === null) ||
      b.monthly - a.monthly,
  );
}
