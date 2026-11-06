// "How much do I need?" for goals people can't put a number on. Plain,
// explainable maths; AI only ever suggests a cost to start from, never the
// sums. Every result says what it assumed, so it can be changed.

import { addMonths } from "./dates";

export interface CalcResult {
  /** Amount to save, in today's money (what the goal form stores). */
  target: number;
  /** When it's needed, or null for no fixed date. */
  targetDate: string | null;
  /** % a year the target grows by until then (0 for none). */
  inflationPct: number;
  /** The headline, e.g. "about ₹4.2 Cr when you retire". */
  headline: { amount: number; when: string };
  /** How it was worked out, one plain line each. */
  steps: string[];
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;
/** Round to a sensible step for the size. */
export function tidy(n: number): number {
  if (n >= 1e7) return roundTo(n, 1e5);
  if (n >= 1e5) return roundTo(n, 1e4);
  return roundTo(n, 1000);
}

export interface RetirementInput {
  age: number;
  retireAge: number;
  /** Plan for money to last until this age. */
  lifeTo: number;
  /** Monthly spending today that continues in retirement. */
  monthlyExpenses: number;
  inflationPct: number;
  /** Return on the retirement money while drawing from it, % a year. */
  returnAfterPct: number;
  todayISO: string;
}

/**
 * The corpus that pays today's lifestyle (grown with prices) from
 * retirement until `lifeTo`, drawn at the start of each year, while the rest
 * keeps earning `returnAfterPct`.
 */
export function retirementNumber(i: RetirementInput): CalcResult {
  const years = Math.max(0, i.retireAge - i.age);
  const span = Math.max(1, i.lifeTo - i.retireAge);
  const infl = i.inflationPct / 100;
  const annualThen = i.monthlyExpenses * 12 * Math.pow(1 + infl, years);
  // Real return: what the money earns above price rises.
  const real = (1 + i.returnAfterPct / 100) / (1 + infl) - 1;
  const factor =
    Math.abs(real) < 1e-9
      ? span
      : ((1 - Math.pow(1 + real, -span)) / real) * (1 + real);
  const corpus = annualThen * factor;
  const today = corpus / Math.pow(1 + infl, years);
  const date = addMonths(i.todayISO, years * 12);
  return {
    target: tidy(today),
    targetDate: years > 0 ? date : null,
    inflationPct: i.inflationPct,
    headline: { amount: tidy(corpus), when: `at ${i.retireAge}` },
    steps: [
      `You spend ${fmt(i.monthlyExpenses)} a month today. At ${i.inflationPct}% a year for ${years} years, that's ${fmt(annualThen / 12)} a month when you retire.`,
      `It needs to last ${span} years, from ${i.retireAge} to ${i.lifeTo}, while the money left over earns ${i.returnAfterPct}% a year.`,
      `That takes about ${fmt(corpus)} at ${i.retireAge}, which is ${fmt(today)} in today's money.`,
      "EPF, NPS and other investments you link to this goal count toward it.",
    ],
  };
}

export interface EmergencyInput {
  /** Essential costs a month, EMIs included. */
  monthly: number;
  months: number;
}

export function emergencyNumber(i: EmergencyInput): CalcResult {
  const target = tidy(i.monthly * i.months);
  return {
    target,
    targetDate: null,
    inflationPct: 0,
    headline: { amount: target, when: "kept ready" },
    steps: [
      `${i.months} months of essential costs and EMIs at ${fmt(i.monthly)} a month.`,
      "Kept somewhere safe and quick to reach, like a liquid fund or savings account.",
    ],
  };
}

/** Months of cover to suggest: more when others depend on one income. */
export function suggestedMonths(opts: {
  dependents: number;
  soleEarner: boolean;
}): { months: number; why: string } {
  if (opts.soleEarner && opts.dependents > 0)
    return { months: 9, why: "others depend on your income alone" };
  if (opts.dependents > 0 || opts.soleEarner)
    return { months: 6, why: "the usual cover" };
  return { months: 6, why: "the usual cover" };
}

export interface HouseInput {
  price: number;
  downPct: number;
  /** Stamp duty, registration and other buying costs, % of price. */
  extrasPct: number;
  /** Years until you buy. */
  years: number;
  inflationPct: number;
  todayISO: string;
}

export function houseNumber(i: HouseInput): CalcResult {
  const down = (i.price * i.downPct) / 100;
  const extras = (i.price * i.extrasPct) / 100;
  const target = tidy(down + extras);
  const then = target * Math.pow(1 + i.inflationPct / 100, i.years);
  return {
    target,
    targetDate: i.years > 0 ? addMonths(i.todayISO, i.years * 12) : null,
    inflationPct: i.inflationPct,
    headline: { amount: tidy(then), when: `in ${i.years} years` },
    steps: [
      `${i.downPct}% down payment on a ${fmt(i.price)} home: ${fmt(down)}.`,
      `Plus about ${i.extrasPct}% for stamp duty, registration and other costs: ${fmt(extras)}.`,
      `${fmt(target)} today, about ${fmt(then)} in ${i.years} years with prices rising ${i.inflationPct}% a year. A home loan covers the rest.`,
    ],
  };
}

export interface CostInput {
  /** Cost in today's money (typed, or picked from an estimate). */
  cost: number;
  years: number;
  inflationPct: number;
  todayISO: string;
  /** What the cost is, for the explanation. */
  what: string;
}

/** Any other goal: today's cost, grown with prices until it's needed. */
export function costNumber(i: CostInput): CalcResult {
  const target = tidy(i.cost);
  const then = target * Math.pow(1 + i.inflationPct / 100, i.years);
  return {
    target,
    targetDate: i.years > 0 ? addMonths(i.todayISO, i.years * 12) : null,
    inflationPct: i.inflationPct,
    headline: { amount: tidy(then), when: `in ${i.years} years` },
    steps: [
      `${i.what} costs about ${fmt(target)} today.`,
      `With prices rising ${i.inflationPct}% a year, that's about ${fmt(then)} in ${i.years} years.`,
    ],
  };
}

/** ₹ in lakh / crore words for explanations. */
export function fmt(n: number): string {
  const v = Math.round(n);
  if (v >= 1e7)
    return `₹${(v / 1e7).toFixed(v >= 1e8 ? 1 : 2).replace(/\.?0+$/, "")} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1).replace(/\.0$/, "")}L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

export interface CostEstimate {
  low: number;
  typical: number;
  high: number;
  assumptions: string[];
}

/** Reads the AI's estimate; anything malformed or implausible is rejected. */
export function parseEstimate(text: string): CostEstimate | null {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : text);
    const n = (x: unknown) =>
      typeof x === "number" && Number.isFinite(x) && x > 0
        ? Math.round(x)
        : null;
    const low = n(j.low);
    const typical = n(j.typical);
    const high = n(j.high);
    if (!low || !typical || !high) return null;
    if (!(low <= typical && typical <= high)) return null;
    if (high > 1e10 || low < 1000) return null;
    const assumptions = Array.isArray(j.assumptions)
      ? j.assumptions
          .filter((a: unknown) => typeof a === "string")
          .slice(0, 5)
          .map((a: string) => a.slice(0, 160))
      : [];
    return {
      low: tidy(low),
      typical: tidy(typical),
      high: tidy(high),
      assumptions,
    };
  } catch {
    return null;
  }
}

export const ESTIMATE_PROMPT = `You estimate what something costs in India today, in rupees, for someone planning a savings goal.
Reply with JSON only: {"low": number, "typical": number, "high": number, "assumptions": [short strings]}.
- Amounts are whole rupees in today's prices, before any future price rises.
- low/typical/high cover a sensible range for the description; typical is the middle case.
- 2 to 4 assumptions, each under 15 words, saying what the estimate includes (e.g. "tuition and living costs for 2 years").
- Never name a bank, lender, fund, college, venue, brand or company.
- If the description isn't a cost you can estimate, reply {"low":0,"typical":0,"high":0,"assumptions":["not enough to go on"]}.`;
