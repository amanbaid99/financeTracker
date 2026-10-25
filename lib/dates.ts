// Date helpers on plain ISO calendar dates (yyyy-mm-dd). The engine never reads
// the clock; callers pass "today" (in IST) in.

export interface CalendarDate {
  y: number;
  m: number; // 1-12
  d: number;
}

export function parseISODate(iso: string): CalendarDate {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

export function toISODate({ y, m, d }: CalendarDate): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Whole months from `from` to `to`; 0 if `to` is not after `from`. */
export function monthsBetween(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO);
  const b = parseISODate(toISO);
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) months -= 1;
  return Math.max(0, months);
}

export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parseISODate(iso);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return toISODate({ y: ny, m: nm, d: Math.min(d, lastDay) });
}

/** Today's date in India Standard Time. Not used inside the engine. */
export function todayIST(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

/** Next occurrence (today included) among yearly month/day dates. */
export function nextYearlyDate(
  todayISO: string,
  dates: { month: number; day: number }[],
): string | null {
  if (dates.length === 0) return null;
  const t = parseISODate(todayISO);
  const candidates = dates.flatMap(({ month, day }) => [
    toISODate({ y: t.y, m: month, d: day }),
    toISODate({ y: t.y + 1, m: month, d: day }),
  ]);
  const future = candidates.filter((c) => c >= todayISO).sort();
  return future[0] ?? null;
}

/** The EMI date in a given month: `day`, or the month's last day if shorter. */
export function emiDateIn(y: number, m: number, day: number): string {
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return toISODate({ y, m, d: Math.min(day, lastDay) });
}

/** The latest EMI date on or before `iso`. */
export function lastEmiOnOrBefore(iso: string, day: number): string {
  const { y, m } = parseISODate(iso);
  const thisMonth = emiDateIn(y, m, day);
  if (thisMonth <= iso) return thisMonth;
  const prev = parseISODate(addMonths(`${toISODate({ y, m, d: 1 })}`, -1));
  return emiDateIn(prev.y, prev.m, day);
}

/** The first EMI date after `iso`. */
export function nextEmiAfter(iso: string, day: number): string {
  const { y, m } = parseISODate(iso);
  const thisMonth = emiDateIn(y, m, day);
  if (thisMonth > iso) return thisMonth;
  const next = parseISODate(addMonths(`${toISODate({ y, m, d: 1 })}`, 1));
  return emiDateIn(next.y, next.m, day);
}

/** How many EMI dates fall after `fromISO` and on or before `toISO`. */
export function emisBetween(fromISO: string, toISO: string, day: number): number {
  if (toISO <= fromISO) return 0;
  let count = 0;
  let d = nextEmiAfter(fromISO, day);
  while (d <= toISO) {
    count++;
    d = nextEmiAfter(d, day);
  }
  return count;
}
