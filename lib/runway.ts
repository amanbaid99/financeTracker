// "Covered till salary": between jobs, does the money you can reach quickly
// cover everything due until the salary arrives? Worked out for the earliest
// and the latest salary date. Pure: callers pass today and the data in.

import { isLiquid } from "./categories";
import { nextEmiAfter } from "./dates";
import { loanView, nextEmi, type Loan } from "./loans";

export interface RunwayItem {
  id: string;
  kind: "owed_to_me" | "to_pay";
  label: string;
  amount: number;
  due: string | null;
  done: boolean;
}

/** One thing to pay before salary. */
export interface DueLine {
  /** Stable id, for remembering whether to count it. */
  key: string;
  label: string;
  amount: number;
  date: string;
  source: "emi" | "living" | "bill" | "item";
  /** Counted in the total. */
  counted: boolean;
  /** The app's guess when you haven't chosen: why it isn't counted. */
  why?: string;
  /** Your own item, by id (can be marked paid). */
  itemId?: string;
}

export interface RunwayScenario {
  until: string;
  lines: DueLine[];
  due: number;
  /** Liquid money minus what's due, before money owed to you. */
  left: number;
  /** The same, once people pay you back. */
  leftWithOwed: number;
  weeks: number;
  /** Day-to-day money a week that still leaves you covered. */
  weekly: number;
}

export interface Runway {
  liquid: number;
  owedToYou: number;
  best: RunwayScenario;
  worst: RunwayScenario;
}

const DAY = 24 * 3600 * 1000;
const daysBetween = (a: string, b: string) =>
  Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / DAY));
const ymd = (iso: string) => iso.slice(0, 10);

/** Each EMI due after today and on or before `until`, skipping paid ones. */
export function emisUntil(loans: Loan[], today: string, until: string) {
  const out: { key: string; label: string; amount: number; date: string }[] =
    [];
  for (const l of loans) {
    const v = loanView(l, today);
    if (v.closed) continue;
    const first = nextEmi(l, v.state, today);
    if (!first) continue;
    const paid = new Set(l.payments.map((p) => p.dueDate));
    const left = v.state.monthsLeft ?? 600;
    let d = first.date;
    for (let n = 0; n < left && d <= until; n++) {
      if (!paid.has(d))
        out.push({
          key: `emi:${l.id}:${d}`,
          label: `${l.name} EMI`,
          amount: v.state.emi,
          date: d,
        });
      d = nextEmiAfter(d, v.state.emiDay);
    }
  }
  return out;
}

/**
 * A bills-fund payment that only repeats something already counted: an EMI
 * of the same amount (or the EMIs due together) within 10 days, or a month's
 * living costs when they're counted already.
 */
function repeats(
  bill: { name: string; amount: number; date: string },
  emis: { amount: number; date: string }[],
  monthlyLiving: number,
): string | null {
  const near = emis.filter(
    (e) => Math.abs(Date.parse(e.date) - Date.parse(bill.date)) <= 10 * DAY,
  );
  if (near.some((e) => e.amount === bill.amount))
    return "Looks like an EMI that's already counted";
  if (near.length > 1 && near.reduce((s, e) => s + e.amount, 0) === bill.amount)
    return "Looks like EMIs that are already counted";
  if (monthlyLiving > 0 && /expens|living|month/i.test(bill.name))
    return "Looks like living costs, already counted";
  return null;
}

export function runway(opts: {
  today: string;
  salaryBest: string;
  salaryWorst: string;
  investments: { kind: string; category: string | null; value: number }[];
  loans: Loan[];
  /** Usual monthly living costs (the budget's costs). */
  monthlyLiving: number;
  /** Bills-fund payments, from each fund's upcoming list. */
  bills: { goalId: string; name: string; amount: number; date: string }[];
  items: RunwayItem[];
  /** Your choices per line key: count it or not. */
  choices: Record<string, boolean>;
}): Runway {
  const liquid = Math.round(
    opts.investments
      .filter((i) => isLiquid(i.kind, i.category))
      .reduce((s, i) => s + i.value, 0),
  );
  const owedToYou = opts.items
    .filter((i) => i.kind === "owed_to_me" && !i.done)
    .reduce((s, i) => s + i.amount, 0);

  const scenario = (until: string): RunwayScenario => {
    const emis = emisUntil(opts.loans, opts.today, until);
    const days = daysBetween(opts.today, until);
    const living = Math.round((opts.monthlyLiving * 12 * days) / 365);
    const lines: DueLine[] = [
      ...emis.map((e) => ({ ...e, source: "emi" as const, counted: true })),
    ];
    if (living > 0)
      lines.push({
        key: "living",
        label: "Living costs",
        amount: living,
        date: until,
        source: "living",
        counted: true,
      });
    for (const b of opts.bills) {
      if (b.date < opts.today || b.date > until) continue;
      const key = `bill:${b.goalId}:${b.name}:${b.date}`;
      const why = repeats(b, emis, opts.monthlyLiving);
      lines.push({
        key,
        label: b.name,
        amount: b.amount,
        date: b.date,
        source: "bill",
        counted: opts.choices[key] ?? !why,
        why: why ?? undefined,
      });
    }
    for (const i of opts.items) {
      if (i.kind !== "to_pay" || i.done) continue;
      if (i.due && i.due > until) continue;
      lines.push({
        key: `item:${i.id}`,
        label: i.label,
        amount: i.amount,
        date: i.due ?? opts.today,
        source: "item",
        counted: true,
        itemId: i.id,
      });
    }
    for (const l of lines)
      if (l.source !== "bill" && opts.choices[l.key] === false)
        l.counted = false;
    lines.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
    const due = lines
      .filter((l) => l.counted)
      .reduce((s, l) => s + l.amount, 0);
    const left = liquid - due;
    const weeks = Math.max(1, days / 7);
    const livingCounted = lines.some((l) => l.key === "living" && l.counted);
    // Living costs are already in what's due; when short, trim them first.
    const weeklyBase = livingCounted ? living / weeks : 0;
    const weekly = Math.max(
      0,
      Math.floor((weeklyBase + Math.min(0, left) / weeks) / 100) * 100,
    );
    return {
      until: ymd(until),
      lines,
      due,
      left,
      leftWithOwed: left + owedToYou,
      weeks: Math.round(weeks * 10) / 10,
      weekly,
    };
  };

  return {
    liquid,
    owedToYou,
    best: scenario(opts.salaryBest),
    worst: scenario(opts.salaryWorst),
  };
}

/** Between jobs: salary dates set and the latest not yet passed. */
export const betweenJobs = (
  p: { salary_best: string | null; salary_worst: string | null } | null,
  today: string,
) => !!p?.salary_worst && !!p.salary_best && p.salary_worst >= today;
