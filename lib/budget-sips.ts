// Your monthly SIPs, set by hand on the Budget page: each row is a fund or
// account, a monthly amount and the goal it's for. Rows live in the saved
// budget. When Save & invest changes, unlocked rows scale with it. Pure.

import { z } from "zod";

export const sipRowSchema = z.object({
  id: z.string().min(1).max(100),
  /** One of your holdings, or null for one you haven't added yet. */
  investmentId: z.string().uuid().nullable(),
  label: z.string().trim().min(1, "Name the fund or account.").max(80),
  amount: z.number().int().min(0).max(1e9),
  goalId: z.string().uuid().nullable(),
  /** Keeps its amount when Save & invest changes. */
  locked: z.boolean().optional(),
});
export type SipRow = z.infer<typeof sipRowSchema>;

export const sipTotal = (rows: SipRow[]) =>
  rows.reduce((s, r) => s + r.amount, 0);

/**
 * Fits rows to a new monthly total: locked rows keep their amount; the rest
 * share what's left in the same proportions as before. Rounds to whole
 * rupees and gives the remainder to the biggest row, so it adds up exactly.
 */
export function scaleSips(rows: SipRow[], total: number): SipRow[] {
  const locked = rows.filter((r) => r.locked).reduce((s, r) => s + r.amount, 0);
  const free = rows.filter((r) => !r.locked);
  const before = free.reduce((s, r) => s + r.amount, 0);
  const room = Math.max(0, total - locked);
  if (!free.length || before === room) return rows.map((r) => ({ ...r }));
  const scaled = new Map(
    free.map((r) => [
      r.id,
      before > 0
        ? Math.floor((r.amount * room) / before)
        : Math.floor(room / free.length),
    ]),
  );
  let rest = room - [...scaled.values()].reduce((a, b) => a + b, 0);
  const order = [...free].sort(
    (a, b) => b.amount - a.amount || a.id.localeCompare(b.id),
  );
  for (let i = 0; rest > 0 && order.length; i = (i + 1) % order.length, rest--)
    scaled.set(order[i].id, (scaled.get(order[i].id) ?? 0) + 1);
  return rows.map((r) =>
    r.locked ? { ...r } : { ...r, amount: scaled.get(r.id) ?? 0 },
  );
}

/** How the rows compare with Save & invest. */
export function sipStatus(rows: SipRow[], budget: number | null) {
  const assigned = sipTotal(rows);
  if (budget === null) return { assigned, left: 0, over: 0 };
  return {
    assigned,
    left: Math.max(0, budget - assigned),
    over: Math.max(0, assigned - budget),
  };
}

/** Monthly SIP amount planned for each goal. */
export function sipsByGoal(rows: SipRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows)
    if (r.goalId && r.amount > 0)
      out.set(r.goalId, (out.get(r.goalId) ?? 0) + r.amount);
  return out;
}

/** Splits an amount equally, whole rupees, the first ones taking any remainder. */
export function equalSplit(amount: number, count: number): number[] {
  if (count <= 0 || amount <= 0) return [];
  const base = Math.floor(amount / count);
  const extra = amount - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}
