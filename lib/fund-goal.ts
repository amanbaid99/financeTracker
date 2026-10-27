// For a goal with nothing saving toward it yet: which existing investments
// could be linked to it, and what new investment would suit it. Suggestions
// only; nothing is linked or added until the person saves it.

import { categoryForHorizon } from "./allocate";
import { categoryLabel } from "./categories";
import { assetClassOf, type AssetClass } from "./portfolio";
import {
  freePercent,
  type Investment,
  type Link,
  type TrackedGoal,
} from "./tracker";

export interface ExistingOption {
  investment: Investment;
  /** Share of it not yet on any goal, %. */
  freePercent: number;
  freeValue: number;
  /** "good" suits the timeline; "ok" works but isn't ideal. */
  fit: "good" | "ok";
  why: string;
}

export interface NewOption {
  category: string;
  categoryLabel: string;
  why: string;
  /** Monthly SIP that gets there on time; 0 when the goal has no date. */
  monthly: number;
}

export interface WaysToFund {
  existing: ExistingOption[];
  fresh: NewOption | null;
}

/** How well a kind of holding suits money needed in `months`. */
function fitFor(
  cls: AssetClass,
  months: number | null,
  type: string,
): { fit: "good" | "ok" | null; why: string } {
  const safe = cls === "cash" || cls === "debt";
  if (
    type === "emergency_fund" ||
    type === "bills_fund" ||
    (months !== null && months < 36)
  ) {
    if (safe) return { fit: "good", why: "low risk, suits money needed soon" };
    if (cls === "hybrid")
      return { fit: "ok", why: "some ups and downs for money needed soon" };
    return { fit: null, why: "" }; // equity, gold, retirement: too risky or locked in
  }
  if (months !== null && months < 60) {
    if (cls === "hybrid" || cls === "debt")
      return { fit: "good", why: "steady, suits 3 to 5 years" };
    if (cls === "equity" || cls === "cash")
      return {
        fit: "ok",
        why:
          cls === "equity"
            ? "can swing over 3 to 5 years"
            : "safe but grows slowly",
      };
    return { fit: null, why: "" };
  }
  if (cls === "equity" || cls === "hybrid")
    return { fit: "good", why: "can grow over 5+ years" };
  if (cls === "debt" || cls === "cash" || cls === "gold")
    return { fit: "ok", why: "safe but grows slower than equity" };
  if (cls === "retirement" && type === "retirement")
    return { fit: "good", why: "made for retirement" };
  return { fit: null, why: "" };
}

export function waysToFund(
  goal: TrackedGoal,
  investments: Investment[],
  links: Link[],
): WaysToFund {
  if (goal.status === "reached" || goal.emisCloseFirst)
    return { existing: [], fresh: null };
  const linked = new Set(goal.lines.map((l) => l.investment.id));
  const existing: ExistingOption[] = [];
  for (const i of investments) {
    if (linked.has(i.id)) continue;
    const free = freePercent(i.id, links, goal.id);
    const freeValue = Math.round((i.value * free) / 100);
    if (free <= 0 || (freeValue <= 0 && i.monthlySip <= 0)) continue;
    const { fit, why } = fitFor(assetClassOf(i), goal.months, goal.type);
    if (!fit) continue;
    existing.push({ investment: i, freePercent: free, freeValue, fit, why });
  }
  existing.sort((a, b) =>
    a.fit === b.fit ? b.freeValue - a.freeValue : a.fit === "good" ? -1 : 1,
  );

  const { category, why } = categoryForHorizon(goal.months, goal.type);
  const monthly = goal.targetDate ? goal.extraSipNeeded : 0;
  return {
    existing: existing.slice(0, 3),
    fresh: { category, categoryLabel: categoryLabel(category), why, monthly },
  };
}
