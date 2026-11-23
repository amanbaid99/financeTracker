// Suggestions on Goals: which of your money should cover which goal (accept
// or change), and ways to keep your holdings simple (move, merge, sell).
// Pure; nothing is saved here. Names only your own holdings.

import { formatINR } from "./format";
import { asKind, KIND_LABELS } from "./instruments";
import { categoryLabel } from "./categories";
import { assetClassOf } from "./portfolio";
import { simplifyHints } from "./simplify";
import { poolOf, type AutoAllocation, type Pool } from "./auto-allocate";
import type { Investment, Link, TrackedGoal } from "./tracker";

export interface MappingRow {
  investmentId: string;
  label: string;
  percent: number;
  value: number;
}
export interface MappingSuggestion {
  key: string;
  goalId: string;
  goalName: string;
  proposed: MappingRow[];
  /** What covers it now, in a few words. */
  now: string;
}
export interface TidySuggestion {
  key: string;
  title: string;
  text: string;
}

export const holdingLabel = (i: Investment) =>
  i.name?.trim() ||
  (i.kind === "mutual_fund"
    ? categoryLabel(i.category)
    : KIND_LABELS[asKind(i.kind)]);

const round2 = (n: number) => Math.floor(n * 100) / 100;
const shape = (links: Link[], goalId: string) =>
  links
    .filter((l) => l.goalId === goalId && round2(l.percent) > 0)
    .map((l) => `${l.investmentId}:${Math.round(l.percent)}`)
    .sort()
    .join("|");

const active = (g: TrackedGoal) =>
  g.status !== "reached" && !(g.loanState && g.emisCloseFirst);

/** Goals whose suggested mapping differs from what covers them now. */
export function mappingSuggestions(
  goals: TrackedGoal[],
  investments: Investment[],
  current: Link[],
  proposed: Link[],
): MappingSuggestion[] {
  const byId = new Map(investments.map((i) => [i.id, i]));
  const rows = (links: Link[], goalId: string): MappingRow[] =>
    links
      .filter(
        (l) =>
          l.goalId === goalId &&
          byId.has(l.investmentId) &&
          round2(l.percent) > 0,
      )
      .map((l) => {
        const inv = byId.get(l.investmentId)!;
        return {
          investmentId: inv.id,
          label: holdingLabel(inv),
          percent: round2(Math.min(100, l.percent)),
          value: Math.round((inv.value * l.percent) / 100),
        };
      })
      .sort((a, b) => b.value - a.value);
  return goals.filter(active).flatMap((g) => {
    const next = rows(proposed, g.id);
    if (!next.length || shape(proposed, g.id) === shape(current, g.id))
      return [];
    const now = rows(current, g.id);
    return [
      {
        key: `map:${g.id}:${shape(proposed, g.id).slice(0, 60)}`,
        goalId: g.id,
        goalName: g.name,
        proposed: next,
        now: now.length ? now.map((r) => r.label).join(", ") : "nothing yet",
      },
    ];
  });
}

/** Ways to keep it simple: merge, small holdings, idle money, unsuited money. */
export function tidySuggestions(
  goals: TrackedGoal[],
  investments: Investment[],
  links: Link[],
  allocation: Pick<AutoAllocation, "spare" | "spareTotal">,
): TidySuggestion[] {
  // Spare money from the mapping you actually have, not the automatic split.
  void allocation;
  const spare: Partial<Record<Pool, number>> = {};
  for (const i of investments) {
    const pool = poolOf(i);
    const used = links
      .filter((l) => l.investmentId === i.id)
      .reduce((s, l) => s + l.percent, 0);
    const free = Math.round((i.value * Math.max(0, 100 - used)) / 100);
    if (pool && free > 0) spare[pool] = (spare[pool] ?? 0) + free;
  }
  const spareTotal = Object.values(spare).reduce((s, v) => s + (v ?? 0), 0);
  const out: TidySuggestion[] = simplifyHints(investments, {
    spare,
    spareTotal,
  }).map((h) => ({
    key: `tidy:${h.id}`,
    title: h.title,
    text: h.text,
  }));
  // Equity covering money needed within a year can fall just when you need it.
  const goalById = new Map(goals.map((g) => [g.id, g]));
  for (const i of investments) {
    if (assetClassOf(i) !== "equity") continue;
    const soon = links
      .filter((l) => l.investmentId === i.id)
      .map((l) => goalById.get(l.goalId))
      .filter(
        (g): g is TrackedGoal =>
          !!g &&
          active(g) &&
          (g.type === "emergency_fund" ||
            g.type === "bills_fund" ||
            (g.months !== null && g.months < 12)),
      );
    if (!soon.length) continue;
    out.push({
      key: `tidy:unsuited:${i.id}`,
      title: `${holdingLabel(i)} is equity, for money needed soon`,
      text: `It covers ${soon.map((g) => g.name).join(", ")}. Equity can fall just when you need the money. Consider moving ${formatINR(i.value)} into a liquid fund or savings account you hold.`,
    });
  }
  return out;
}

/** Hide what you've put off; snoozes are yyyy-mm-dd "until" dates. */
export function visible<T extends { key: string }>(
  items: T[],
  snoozes: Record<string, unknown>,
  today: string,
): T[] {
  return items.filter((i) => {
    const until = snoozes[i.key];
    return typeof until !== "string" || until <= today;
  });
}
