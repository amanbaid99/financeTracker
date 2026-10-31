// The money plan as SIPs to start. Each goal's monthly amount goes into a
// fund you already hold where one suits it: first one already saving for
// that goal, then one not yet used by any goal. Only when you hold nothing
// suitable does it name a kind of fund ("New liquid fund"). Your own funds
// are named; nothing new is ever named.

import type { Suggestion } from "./allocate";
import { categoryLabel } from "./categories";
import { asKind, etfCategory, isEtf } from "./instruments";
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
  /** Why this holding is in the plan, when "close enough" doesn't say it. */
  note: string | null;
  monthly: number;
  parts: SipPart[];
}

export type SipStrategy = "simple" | "diversified";

/** Amounts in a suggestion are additions to an existing monthly contribution. */
export function sipAction(line: SipLine) {
  const current = line.investment?.monthlySip ?? 0;
  return {
    kind: current > 0 ? "Increase" : "Start",
    current,
    extra: line.monthly,
    total: current + line.monthly,
  };
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
    "gold",
  ],
  balanced_advantage: [
    "balanced_advantage",
    "aggressive_hybrid",
    "multi_asset",
    "conservative_hybrid",
    "gold",
  ],
  equity_index: [
    "equity_index",
    "large_cap",
    "flexi_cap",
    "elss",
    "mid_small_cap",
    "international",
    "gold",
  ],
};

/** Gold spreads the risk but can swing, so it gets at most this share of a goal. */
const GOLD_CAP = 0.2;

/** The kind of fund an investment is, for matching ("savings_account" for a bank account). */
function kindOf(i: Investment): string | null {
  const k = asKind(i.kind);
  // ETFs: any amount from one unit (often ₹100 or so), sold any day.
  if (isEtf(i)) return etfCategory(i.name);
  if (k === "mutual_fund") return i.category;
  if (k === "savings") return "savings_account";
  return null; // stocks, FDs, PPF, EPF, NPS, physical gold: not something to SIP into here
}

/** Smallest amount worth putting in, and the step amounts round to. */
function sizeOf(i: Investment, lump: boolean): number {
  if (isEtf(i)) return 100;
  return lump ? 1000 : 500;
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
  /** Why it's here, when "close enough" doesn't say it (an ETF, capped gold). */
  note: string | null;
}

function noteFor(i: Investment): string | null {
  if (kindOf(i) === "gold")
    return "gold, to spread the risk. Kept to a fifth of this goal as it can swing";
  if (isEtf(i)) return "an ETF, buy units each month";
  if (kindOf(i) === "savings_account")
    return "a savings account earns less than a liquid fund; consider one for this";
  return null;
}

/** Exact match 3 parts, close stand-ins 2, looser ones 1. */
const weightOf = (r: number) => (r === 0 ? 3 : r <= 2 ? 2 : 1);

/**
 * Splits `total` by `weights`. Each part rounds to its own step and gets at
 * least one step; gold is held to GOLD_CAP; the rounding goes to the biggest
 * part it fits.
 */
function splitAmount(
  total: number,
  weights: number[],
  steps: number[],
  gold: boolean[],
): number[] {
  if (total <= 0) return weights.map(() => 0);
  const sum = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((w, k) =>
    Math.max(steps[k], Math.round((total * w) / sum / steps[k]) * steps[k]),
  );
  parts.forEach((p, k) => {
    if (!gold[k] || parts.length === 1) return;
    const cap = Math.max(
      steps[k],
      Math.floor((total * GOLD_CAP) / steps[k]) * steps[k],
    );
    parts[k] = Math.min(p, cap);
  });
  const rest = total - parts.reduce((a, b) => a + b, 0);
  if (rest) {
    const order = parts
      .map((p, k) => k)
      .filter((k) => !gold[k] || parts.length === 1)
      .sort((a, b) => parts[b] - parts[a]);
    const k = order.find((k) => rest % steps[k] === 0) ?? order[0] ?? 0;
    parts[k] += rest;
  }
  return parts;
}

/**
 * Where a goal's monthly amount (and lump sum) should go, spread across the
 * funds you already hold for it:
 * - only funds that suit the kind of fund the goal needs, one per kind, so
 *   it spreads across different funds rather than copies of one;
 * - funds that are only this goal's come before funds shared with others;
 * - a savings account only if no mutual fund suits;
 * - up to three funds, weighted by how well each fits (3, 2 or 1 parts);
 * - each gets at least what it can take: ₹500 a month (₹1,000 of a lump
 *   sum) for a fund, ₹100 for an ETF, which you can buy a unit at a time;
 * - gold (a gold ETF) gets at most a fifth, as it can swing.
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
  strategy: SipStrategy = "diversified",
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
  if (strategy === "simple")
    cands = cands.filter((c) => kindOf(c.i) !== "gold");
  // Funds only this goal uses come first; shared ones only if that's all there is.
  if (cands.some((c) => c.pct >= 100))
    cands = cands.filter((c) => c.pct >= 100);
  if (!cands.length) {
    const spare = suitable(
      investments.filter(
        (i) =>
          !pctOf.has(i.id) &&
          freePercent(i.id, links) >= 100 &&
          (strategy !== "simple" || kindOf(i) !== "gold"),
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
            note: noteFor(spare.i),
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
  if (strategy === "simple") {
    const c = cands[0];
    return [
      {
        investment: c.i,
        monthly,
        lump,
        similar: c.r > 0,
        percent: c.pct,
        note: noteFor(c.i),
      },
    ];
  }
  // One fund per kind: two of the same kind isn't spreading the risk.
  const seen = new Set<string>();
  cands = cands.filter((c) => {
    const k = kindOf(c.i)!;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // Add funds, best first, while each can still get its smallest amount.
  const lumpOnly = monthly <= 0;
  const amount = lumpOnly ? lump : monthly;
  const picked: Cand[] = [];
  let need = 0;
  for (const c of cands) {
    if (picked.length === 3) break;
    const min = sizeOf(c.i, lumpOnly);
    if (picked.length && need + min > amount) continue;
    picked.push(c);
    need += min;
  }
  cands = picked;

  const weights = cands.map((c) => weightOf(c.r));
  const gold = cands.map((c) => kindOf(c.i) === "gold");
  const monthlies = splitAmount(
    monthly,
    weights,
    cands.map((c) => sizeOf(c.i, false)),
    gold,
  );
  const lumps = splitAmount(
    lump,
    weights,
    cands.map((c) => sizeOf(c.i, true)),
    gold,
  );
  return cands.map((c, k) => ({
    investment: c.i,
    monthly: monthlies[k],
    lump: lumps[k],
    similar: c.r > 0,
    percent: c.pct,
    note: noteFor(c.i),
  }));
}

export function sipPlan(
  suggestions: Suggestion[],
  investments: Investment[] = [],
  links: Link[] = [],
  strategy: SipStrategy = "diversified",
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
      strategy,
    );
    if (!shares.length) {
      add(
        `new:${s.category}`,
        () => ({
          investment: null,
          label: `New ${categoryLabel(s.category).toLowerCase()}`,
          category: s.category,
          similar: false,
          note: null,
          monthly: 0,
          parts: [],
        }),
        s,
        s.monthly,
      );
      continue;
    }
    for (const sh of shares.filter((share) => share.monthly > 0))
      add(
        `inv:${sh.investment.id}`,
        () => ({
          investment: sh.investment,
          label:
            sh.investment.name?.trim() || categoryLabel(kindOf(sh.investment)),
          category: s.category,
          similar: sh.similar,
          note: sh.note,
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

/** One thing to do this month: raise a SIP and/or add a one-time amount to one holding. */
export interface PlanStep {
  key: string;
  /** Your holding, or null when you hold nothing suitable yet. */
  investment: Investment | null;
  label: string;
  /** Kind of fund the plan asked for (for a new one). */
  category: string;
  /** Extra a month on top of the current SIP. */
  addMonthly: number;
  /** One-time amount to put in now. */
  addLump: number;
  /** Goals this step pays for, soonest first. */
  goals: { id: string; name: string }[];
  note: string | null;
}

/**
 * The plan as a checklist: one step per holding, with its monthly raise
 * (from sipPlan) and any one-time amount (split the same way) together.
 */
export function planSteps(
  suggestions: Suggestion[],
  investments: Investment[] = [],
  links: Link[] = [],
  strategy: SipStrategy = "diversified",
): PlanStep[] {
  const steps = new Map<string, PlanStep>();
  const addGoal = (step: PlanStep, id: string, name: string) => {
    if (!step.goals.some((g) => g.id === id)) step.goals.push({ id, name });
  };
  for (const l of sipPlan(suggestions, investments, links, strategy)) {
    const key = l.investment ? `inv:${l.investment.id}` : `new:${l.category}`;
    const step: PlanStep = {
      key,
      investment: l.investment,
      label: l.label,
      category: l.category,
      addMonthly: l.monthly,
      addLump: 0,
      goals: [],
      note: l.note,
    };
    for (const p of l.parts) addGoal(step, p.goalId, p.goalName);
    steps.set(key, step);
  }
  for (const s of suggestions) {
    if (s.lump <= 0) continue;
    const shares = splitForGoal(
      s.goalId,
      s.category,
      0,
      s.lump,
      investments,
      links,
      strategy,
    ).filter((sh) => sh.lump > 0);
    const parts = shares.length
      ? shares.map((sh) => ({
          key: `inv:${sh.investment.id}`,
          investment: sh.investment as Investment | null,
          label:
            sh.investment.name?.trim() || categoryLabel(kindOf(sh.investment)),
          lump: sh.lump,
          note: sh.note,
        }))
      : [
          {
            key: `new:${s.category}`,
            investment: null,
            label: `New ${categoryLabel(s.category).toLowerCase()}`,
            lump: s.lump,
            note: null,
          },
        ];
    for (const p of parts) {
      const step = steps.get(p.key) ?? {
        key: p.key,
        investment: p.investment,
        label: p.label,
        category: s.category,
        addMonthly: 0,
        addLump: 0,
        goals: [],
        note: p.note,
      };
      step.addLump += p.lump;
      addGoal(step, s.goalId, s.goalName);
      steps.set(p.key, step);
    }
  }
  // Your own holdings first, biggest first; new ones last.
  return [...steps.values()].sort(
    (a, b) =>
      Number(a.investment === null) - Number(b.investment === null) ||
      b.addMonthly + b.addLump / 12 - (a.addMonthly + a.addLump / 12),
  );
}
