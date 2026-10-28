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
  equity_index: ["equity_index", "large_cap", "flexi_cap", "elss"],
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

export function sipPlan(
  suggestions: Suggestion[],
  investments: Investment[] = [],
  links: Link[] = [],
): SipLine[] {
  const lines = new Map<string, SipLine>();
  for (const s of suggestions) {
    if (s.monthly <= 0) continue;
    const pick = pickFund(s.goalId, s.category, investments, links);
    const key = pick ? `inv:${pick.investment.id}` : `new:${s.category}`;
    const line = lines.get(key) ?? {
      investment: pick?.investment ?? null,
      label: pick
        ? pick.investment.name?.trim() || categoryLabel(kindOf(pick.investment))
        : `New ${categoryLabel(s.category).toLowerCase()}`,
      category: s.category,
      similar: pick?.similar ?? false,
      monthly: 0,
      parts: [],
    };
    line.monthly += s.monthly;
    line.parts.push({
      goalId: s.goalId,
      goalName: s.goalName,
      monthly: s.monthly,
      until: stopsAt(s),
    });
    lines.set(key, line);
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
