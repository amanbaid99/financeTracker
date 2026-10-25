// Between incomes: which holdings you live on, in what order, and how long
// they last. Pure function over the engine's data shapes.

import { categoryLabel, isEquity, isLiquid } from "./categories";
import { addMonths } from "./dates";
import type { FinanceData, Holding } from "./types";

/** Retirement accounts that can't (or shouldn't) be drawn on for living costs. */
const LOCKED_KINDS = new Set(["ppf", "epf", "nps"]);

export interface TransitionFund {
  id: string;
  label: string;
  /** Short note on what kind of money it is, e.g. "Liquid fund". */
  kindLabel: string;
  value: number;
  /** Lower is used first. */
  tier: number;
  /** Month (from now, 0-based, fractional) this fund starts being used and runs out. */
  fromMonth: number;
  toMonth: number;
  goalLinked: boolean;
}

export interface TransitionPlan {
  /** True when the user picked holdings; false means we suggested liquid ones. */
  chosen: boolean;
  funds: TransitionFund[];
  /** Holdings that could be picked (not locked retirement accounts). */
  candidates: { id: string; label: string; kindLabel: string; value: number; picked: boolean }[];
  total: number;
  /** Card bills paid out of this money first. */
  cardDues: number;
  /** Essentials a month: expenses, EMIs, insurance, planned costs. */
  monthlyNeed: number;
  sipsMonthly: number;
  /** Months covered with SIPs paused, and with SIPs kept running. */
  months: number | null;
  monthsWithSips: number | null;
  /** ISO date the money runs out (SIPs paused), and when 3 months are left. */
  runsOutOn: string | null;
  actBy: string | null;
  /** Where this month's living money comes from. */
  thisMonth: { label: string; amount: number }[];
  notes: string[];
}

function tierOf(h: Holding): number {
  if (h.kind === "savings") return h.purpose === "spending" || h.purpose === "bills" ? 0 : 1;
  if (h.kind === "fd" || h.category === "fd_rd" || h.category === "sweep_fd") return 3;
  if (isLiquid(h.kind, h.category)) return 2;
  if (isEquity(h.kind, h.category)) return 6;
  if (h.kind === "gold" || h.kind === "other" || h.category === "gold") return 5;
  return 4; // debt, arbitrage, conservative hybrid
}

function labelOf(h: Holding): string {
  return h.name?.trim() || categoryLabel(h.category);
}

const round1 = (n: number) => Math.floor(n * 10) / 10;

export function buildTransitionPlan(data: FinanceData, monthlyNeed: number, todayISO: string): TransitionPlan {
  const usable = data.holdings.filter((h) => !LOCKED_KINDS.has(h.kind) && h.currentValue > 0);
  const linked = new Set(
    data.allocations
      .filter((a) => data.goals.some((g) => g.id === a.goalId && g.type !== "emergency_fund"))
      .map((a) => a.holdingId),
  );
  const picked = usable.filter((h) => h.transitionFund);
  const chosen = picked.length > 0;
  // Nothing picked yet: suggest money that's quick to reach.
  const base = chosen ? picked : usable.filter((h) => isLiquid(h.kind, h.category));

  // Cheapest-to-use money first; within a tier, goal savings go last.
  const sorted = [...base].sort(
    (a, b) =>
      tierOf(a) - tierOf(b) ||
      Number(linked.has(a.id)) - Number(linked.has(b.id)) ||
      b.currentValue - a.currentValue,
  );
  const cardDues = (data.cards ?? []).reduce((s, c) => s + Math.max(0, c.outstanding), 0);
  const total = sorted.reduce((s, h) => s + h.currentValue, 0);
  const sipsMonthly = data.holdings.reduce((s, h) => s + (h.monthlySip ?? 0), 0);
  const free = Math.max(0, total - cardDues);

  // Card bills come out first, then each month's essentials in fund order.
  let spent = 0;
  const need = monthlyNeed > 0 ? monthlyNeed : null;
  const funds: TransitionFund[] = sorted.map((h) => {
    const startAt = spent;
    spent += h.currentValue;
    const from = need ? Math.max(0, (startAt - cardDues) / need) : 0;
    const to = need ? Math.max(0, (spent - cardDues) / need) : 0;
    return {
      id: h.id,
      label: labelOf(h),
      kindLabel: h.kind === "savings" ? "Bank account" : categoryLabel(h.category),
      value: h.currentValue,
      tier: tierOf(h),
      fromMonth: round1(from),
      toMonth: round1(to),
      goalLinked: linked.has(h.id),
    };
  });

  const months = need ? round1(free / need) : null;
  const monthsWithSips = need ? round1(free / (need + sipsMonthly)) : null;

  // This month's draw: walk the funds in order after card dues.
  const thisMonth: { label: string; amount: number }[] = [];
  if (need) {
    let skip = cardDues;
    let left = need;
    for (const f of funds) {
      let avail = f.value;
      const used = Math.min(skip, avail);
      skip -= used;
      avail -= used;
      if (avail <= 0) continue;
      const take = Math.min(avail, left);
      thisMonth.push({ label: f.label, amount: Math.round(take) });
      left -= take;
      if (left <= 0) break;
    }
  }

  const notes: string[] = [];
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  if (!chosen && usable.length) {
    notes.push("Pick the holdings you'll live on. Until then we count your bank accounts, FDs and liquid funds.");
  }
  if (cardDues > 0) notes.push(`Card bills of ${fmt(cardDues)} are paid from this money first.`);
  if (sipsMonthly > 0 && months !== null && monthsWithSips !== null) {
    notes.push(
      months - monthsWithSips >= 0.5
        ? `Pausing SIPs of ${fmt(sipsMonthly)} a month stretches your money from ${Math.floor(monthsWithSips)} to ${Math.floor(months)} months. Keep them only while more than 6 months are covered.`
        : `Your SIPs of ${fmt(sipsMonthly)} a month barely change how long this lasts. Keep them only while more than 6 months are covered.`,
    );
  }
  if (funds.some((f) => f.tier === 3)) notes.push("Break FDs only when you reach them. Early withdrawal can cost a small penalty.");
  if (funds.some((f) => f.tier >= 4)) {
    notes.push(
      "Market-linked funds come last and are best sold a month at a time. Their value moves, and gains may be taxed.",
    );
  }
  const linkedPicked = funds.filter((f) => f.goalLinked);
  if (linkedPicked.length) {
    notes.push(
      `${linkedPicked.map((f) => f.label).join(", ")} ${linkedPicked.length === 1 ? "is" : "are"} saved for a goal. Using ${linkedPicked.length === 1 ? "it" : "them"} pushes that goal back, so it's used later.`,
    );
  }
  if (months !== null && months < 3) {
    notes.push("Less than 3 months covered. Cut wants to the minimum and pause all new investing until income returns.");
  }
  if (chosen) {
    const extra = usable
      .filter((h) => !h.transitionFund && isLiquid(h.kind, h.category))
      .reduce((s, h) => s + h.currentValue, 0);
    if (extra > 0) notes.push(`You also have ${fmt(extra)} in other quick-to-reach savings you haven't picked.`);
  }

  return {
    chosen,
    funds,
    candidates: usable
      .map((h) => ({
        id: h.id,
        label: labelOf(h),
        kindLabel: h.kind === "savings" ? "Bank account" : categoryLabel(h.category),
        value: h.currentValue,
        picked: !!h.transitionFund,
      }))
      .sort((a, b) => b.value - a.value),
    total,
    cardDues,
    monthlyNeed,
    sipsMonthly,
    months,
    monthsWithSips,
    runsOutOn: months !== null ? addMonths(todayISO, Math.floor(months)) : null,
    actBy: months !== null ? addMonths(todayISO, Math.max(0, Math.floor(months) - 3)) : null,
    thisMonth,
    notes,
  };
}
