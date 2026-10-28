// The money plan as SIPs to start: one per kind of fund, with the goals it
// serves and when each goal's part can stop. Fund types only, never names.

import type { Suggestion } from "./allocate";

export interface SipPart {
  goalId: string;
  goalName: string;
  monthly: number;
  /** Last month this part is needed (yyyy-mm-dd), or null to keep going. */
  until: string | null;
}

export interface SipLine {
  category: string;
  categoryLabel: string;
  monthly: number;
  why: string;
  parts: SipPart[];
}

/** When a goal's SIP can stop: its date, or its last one-time payment. */
function stopsAt(s: Suggestion): string | null {
  const g = s.after;
  if (g.billsFund) {
    const bills = g.billsFund.bills;
    // Only one-time payments: stop after the last one. Repeating bills keep going.
    if (bills.length && bills.every((b) => b.everyMonths === 0))
      return bills.reduce((a, b) => (b.due > a ? b.due : a), bills[0].due);
    return null;
  }
  return g.targetDate;
}

export function sipPlan(suggestions: Suggestion[]): SipLine[] {
  const lines = new Map<string, SipLine>();
  for (const s of suggestions) {
    if (s.monthly <= 0) continue;
    const line = lines.get(s.category) ?? {
      category: s.category,
      categoryLabel: s.categoryLabel,
      monthly: 0,
      why: s.why,
      parts: [],
    };
    line.monthly += s.monthly;
    line.parts.push({
      goalId: s.goalId,
      goalName: s.goalName,
      monthly: s.monthly,
      until: stopsAt(s),
    });
    lines.set(s.category, line);
  }
  for (const l of lines.values())
    l.parts.sort((a, b) =>
      (a.until ?? "9999").localeCompare(b.until ?? "9999"),
    );
  return [...lines.values()].sort((a, b) => b.monthly - a.monthly);
}
