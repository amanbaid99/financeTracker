// Merging a new mapping for some goals into everything else you've saved,
// without using more than 100% of any holding. Pure.

export interface MapRow {
  goalId: string;
  investmentId: string;
  percent: number;
}

const floor2 = (n: number) => Math.floor(n * 100) / 100;

/**
 * Replaces the rows of `goalIds` with `next`. Where a holding would then be
 * more than fully used, the other goals' shares of it shrink to make room
 * (your newest choice wins). Shares round down to 0.01%; empty rows drop.
 */
export function mergeMapping(
  saved: MapRow[],
  goalIds: string[],
  next: MapRow[],
): MapRow[] {
  const changing = new Set(goalIds);
  const fresh = next
    .map((r) => ({ ...r, percent: floor2(Math.min(100, r.percent)) }))
    .filter((r) => r.percent > 0);
  // Your newest choice on its own can't go over 100% of a holding either.
  const freshUse = new Map<string, number>();
  for (const r of fresh) {
    const used = freshUse.get(r.investmentId) ?? 0;
    r.percent = floor2(Math.max(0, Math.min(r.percent, 100 - used)));
    freshUse.set(r.investmentId, used + r.percent);
  }
  const others = saved.filter((r) => !changing.has(r.goalId));
  const kept = others.map((r) => {
    const taken = freshUse.get(r.investmentId) ?? 0;
    if (!taken) return { ...r };
    const otherTotal = others
      .filter((o) => o.investmentId === r.investmentId)
      .reduce((s, o) => s + o.percent, 0);
    const room = Math.max(0, 100 - taken);
    if (otherTotal <= room) return { ...r };
    return { ...r, percent: floor2((r.percent * room) / otherTotal) };
  });
  return [...kept, ...fresh].filter((r) => r.percent > 0);
}
