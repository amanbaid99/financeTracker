// "Where should ₹10,000 go?" questions are answered by the app's own planner,
// not by the AI's arithmetic. The AI only explains the split. This file finds
// such questions, works out the split, and checks the AI's numbers after.

import { planMoney } from "@/lib/allocate";
import { formatINR } from "@/lib/format";
import { monthYear } from "@/lib/goal-summary";
import { planSteps } from "@/lib/sip-plan";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";

export type Frequency = "once" | "monthly" | "unknown";

export interface AmountQuestion {
  amount: number;
  frequency: Frequency;
}

/** ₹10,000 / 10k / 10000 / 1.5L / 2 lakh / 1 crore → rupees. */
export function parseRupees(text: string): number | null {
  const m = text
    .replace(/,/g, "")
    .match(
      /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(k|thousand|l|lakh|lakhs|lac|cr|crore|crores)?\b/i,
    );
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? "").toLowerCase();
  const mult =
    unit.startsWith("k") || unit === "thousand"
      ? 1e3
      : unit.startsWith("l")
        ? 1e5
        : unit.startsWith("c")
          ? 1e7
          : 1;
  const v = Math.round(n * mult);
  return v >= 100 ? v : null;
}

/**
 * A question about where to put an amount, or null. Questions about taking
 * money out ("I need ₹50,000, where should it come from?") aren't these.
 */
export function amountQuestion(text: string): AmountQuestion | null {
  const t = text.toLowerCase();
  if (
    /come from|take (it )?out|withdraw|need .* for|pay for|redeem|sell/.test(t)
  )
    return null;
  // A bare reply to "once or every month?" counts too.
  const reply =
    /^\s*(₹|rs\.?)?\s*[\d,.]+\s*(k|l|lakh|cr)?\s*(once|one[- ]time|every month|a month|monthly)\s*$/.test(
      t,
    );
  if (
    !reply &&
    !/where|invest|put|park|save|allocate|go\b|should i do|use/.test(t)
  )
    return null;
  const amount = parseRupees(t);
  if (!amount) return null;
  const frequency: Frequency =
    /(a|per|every|each)\s+month|monthly|\/\s*mo|\bsip\b/.test(t)
      ? "monthly"
      : /one[- ]?time|\bonce\b|lump|bonus|right now|\btoday\b|extra cash|got ₹|received/.test(
            t,
          )
        ? "once"
        : "unknown";
  return { amount, frequency };
}

/** The quick replies when it isn't clear whether the amount repeats. */
export function frequencyChoices(amount: number): string[] {
  return [`${formatINR(amount)} once`, `${formatINR(amount)} every month`];
}

export interface Split {
  facts: string;
  /** Every rupee figure the app worked out, for checking the reply. */
  numbers: number[];
  /** Nothing to split: every goal already gets what it needs. */
  empty: boolean;
}

/**
 * Splits the amount with the same planner as "This month", described with
 * codes (never names) for the AI.
 */
export function splitFacts(opts: {
  q: AmountQuestion & { frequency: "once" | "monthly" };
  goals: TrackedGoal[];
  investments: Investment[];
  links: Link[];
  todayISO: string;
  codeOf: Record<string, string>;
}): Split {
  const { q, goals, investments, links, todayISO, codeOf } = opts;
  const sipsNow = investments.reduce((s, i) => s + i.monthlySip, 0);
  const plan = planMoney({
    goals,
    investments,
    links,
    lump: q.frequency === "once" ? q.amount : 0,
    monthlyTotal: sipsNow + (q.frequency === "monthly" ? q.amount : 0),
    todayISO,
  });
  const steps = planSteps(plan.suggestions, investments, links);
  const what = q.frequency === "once" ? "one-time amount" : "a month";
  const lines = [
    `The app's split for ${formatINR(q.amount)} ${q.frequency === "once" ? "as a one-time amount" : "a month"} (worked out by the app; explain it, don't change it):`,
  ];
  const numbers = [q.amount];
  for (const st of steps) {
    const amount = q.frequency === "once" ? st.addLump : st.addMonthly;
    if (!amount) continue;
    numbers.push(amount);
    const into = st.investment
      ? `into ${codeOf[st.investment.id]}`
      : `into a new ${st.category.replace(/_/g, " ")}`;
    const goalsFor = st.goals.map((g) => codeOf[g.id]).join(", ");
    lines.push(
      `- ${formatINR(amount)} ${what === "a month" ? "a month " : ""}${into}, for ${goalsFor}.`,
    );
  }
  for (const s of plan.suggestions) {
    const after = afterLine(s.after);
    lines.push(`- With it, ${codeOf[s.goalId]} is ${after.text}.`);
    numbers.push(...after.numbers);
  }
  const left =
    q.frequency === "once" ? plan.leftoverLump : plan.leftoverMonthly;
  if (left > 0) {
    numbers.push(left);
    lines.push(
      `- ${formatINR(left)} is left over: every dated goal already gets what it needs.`,
    );
  }
  if (plan.stillShortMonthly > 0) {
    numbers.push(plan.stillShortMonthly);
    lines.push(
      `- Even so, goals are still ${formatINR(plan.stillShortMonthly)} a month short in total.`,
    );
  }
  return {
    facts: lines.join("\n"),
    numbers,
    empty: steps.length === 0,
  };
}

/** Where a goal stands after the split, without any names the user typed. */
function afterLine(g: TrackedGoal): { text: string; numbers: number[] } {
  if (g.billsFund) {
    const short = g.billsFund.short;
    return short
      ? {
          text: `still ${formatINR(short.amount)} short for its planned payments`,
          numbers: [short.amount],
        }
      : {
          text: "covered for every planned payment in the next year",
          numbers: [],
        };
  }
  if (g.status === "reached") return { text: "fully funded", numbers: [] };
  if (g.status === "behind" || g.extraSipNeeded > 0)
    return {
      text: `still ${formatINR(g.extraSipNeeded)} a month short of being on time`,
      numbers: [g.extraSipNeeded],
    };
  return {
    text: g.targetDate ? `on track for ${monthYear(g.targetDate)}` : "on track",
    numbers: [],
  };
}

/** Rupee amounts and percentages written in a reply. */
function figures(text: string): { rupees: number[]; percents: number[] } {
  const rupees: number[] = [];
  for (const m of text.matchAll(
    /₹\s?([\d,]+(?:\.\d+)?)\s*(k|l|lakh|lakhs|cr|crore)?\b/gi,
  )) {
    const v = parseRupees(m[0]);
    if (v) rupees.push(v);
  }
  const percents = [...text.matchAll(/(\d+(?:\.\d+)?)\s?%/g)].map((m) =>
    Number(m[1]),
  );
  return { rupees, percents };
}

/**
 * Figures in the reply that aren't in the facts (or the question). Each
 * must be within 2% of a known figure, to allow for rounding.
 */
export function unsupportedFigures(
  reply: string,
  facts: string,
  extra: number[] = [],
): string[] {
  const known = figures(facts);
  const rupees = [...known.rupees, ...extra];
  const near = (v: number, list: number[]) =>
    list.some((k) => Math.abs(v - k) <= Math.max(100, Math.abs(k) * 0.02));
  const r = figures(reply);
  const bad: string[] = [];
  for (const v of r.rupees) if (!near(v, rupees)) bad.push(formatINR(v));
  for (const p of r.percents)
    if (!known.percents.some((k) => Math.abs(k - p) <= 0.5)) bad.push(`${p}%`);
  return [...new Set(bad)];
}
