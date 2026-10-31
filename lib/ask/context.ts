// What Ask tells the AI about your money, and how its reply is turned back
// into your own names.
//
// Goal names, investment nicknames and bill names you typed never leave the
// app: each becomes a code like [G1], [I2] or [B1]. Amounts are rounded.
// Nothing about you (name, email, PAN) is ever included.

import { formatINR } from "@/lib/format";
import { goalTypeInfo } from "@/lib/goal-types";
import { monthYear } from "@/lib/goal-summary";
import { categoryLabel } from "@/lib/categories";
import {
  asKind,
  defaultReturn,
  etfLabel,
  isEtf,
  KIND_LABELS,
} from "@/lib/instruments";
import { assetClassOf, ASSET_CLASSES, buildPortfolio } from "@/lib/portfolio";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";

export interface AskContext {
  /** Plain-text facts for the AI, using codes instead of names. */
  facts: string;
  /** Code → the user's own name, for turning the reply back. */
  names: Record<string, string>;
  /** Goal or investment id → its code, for adding app-computed facts. */
  codeOf: Record<string, string>;
}

/** Rounded rupees: to ₹1,000 above ₹10,000, else to ₹100. */
export function rough(n: number): string {
  const r =
    Math.abs(n) >= 10_000
      ? Math.round(n / 1000) * 1000
      : Math.round(n / 100) * 100;
  return formatINR(r);
}

function investmentLabel(i: Investment): string {
  if (isEtf(i)) return etfLabel(i.name);
  const kind = asKind(i.kind);
  return kind === "mutual_fund" ? categoryLabel(i.category) : KIND_LABELS[kind];
}

function goalLine(
  g: TrackedGoal,
  code: string,
  invCodes: Map<string, string>,
): string {
  const type = goalTypeInfo(g.type).label.toLowerCase();
  const parts = [`${code} ${type} goal`];
  if (g.loanState) {
    const l = g.loanState;
    parts.push(
      `loan owed ${rough(l.balance)} at ${l.ratePct}% a year, EMI ${rough(l.emi)}`,
    );
    if (l.endDate) parts.push(`closes on its own ${monthYear(l.endDate)}`);
    if (l.feeRate > 0)
      parts.push(
        `foreclosure charge ${(l.feeRate * 100).toFixed(2)}% of amount owed`,
      );
    if (g.targetDate)
      parts.push(
        `wants to close it by ${monthYear(g.targetDate)}, needing ${rough(g.futureTarget)} then`,
      );
  } else if (g.billsFund) {
    const b = g.billsFund;
    parts.push(
      `fund for planned payments; needs ${rough(b.needsToday)} today; needs ${rough(b.monthlyNeed)} a month${b.short ? `; short ${rough(b.short.amount)} at current pace` : ""}`,
    );
  } else {
    parts.push(
      `target ${rough(g.futureTarget)}${g.targetDate ? ` by ${monthYear(g.targetDate)}` : ", no fixed date"}`,
    );
    if (g.months !== null && g.months > 0)
      parts.push(
        `${g.months} months away (${g.months < 36 ? "short term: keep it low risk" : g.months < 60 ? "medium term" : "long term"})`,
      );
  }
  parts.push(`saved ${rough(g.current)}`);
  if (g.monthlySip) parts.push(`${rough(g.monthlySip)} a month going in`);
  const status =
    g.status === "reached"
      ? "reached"
      : g.status === "behind"
        ? `behind, needs ${rough(g.extraSipNeeded)} more a month`
        : g.status === "overdue"
          ? "date has passed"
          : g.status === "no_investments"
            ? "nothing invested yet"
            : "on track";
  parts.push(`status: ${status}`);
  if (g.lines.length) {
    parts.push(
      `held in ${g.lines
        .map(
          (l) =>
            `${invCodes.get(l.investment.id)} ${investmentLabel(l.investment).toLowerCase()}${l.percent < 100 ? ` (${l.percent}% of it)` : ""}`,
        )
        .join(", ")}`,
    );
  }
  return `- ${parts.join("; ")}.`;
}

export function buildAskContext(opts: {
  goals: TrackedGoal[];
  investments: Investment[];
  links: Link[];
  plan: { lump: number; monthly: number } | null;
  todayISO: string;
}): AskContext {
  const { goals, investments, links, plan, todayISO } = opts;
  const names: Record<string, string> = {};
  const invCodes = new Map<string, string>();
  const goalCodes = new Map<string, string>();
  investments.forEach((i, n) => {
    const code = `[I${n + 1}]`;
    invCodes.set(i.id, code);
    names[code] = i.name?.trim() || investmentLabel(i);
  });
  goals.forEach((g, n) => {
    const code = `[G${n + 1}]`;
    goalCodes.set(g.id, code);
    names[code] = g.name;
  });

  const lines: string[] = [
    `Today is ${monthYear(todayISO)}. Amounts are in Indian rupees and rounded.`,
  ];

  lines.push("", "Goals:");
  if (!goals.length) lines.push("- none yet.");
  let bill = 0;
  for (const g of goals) {
    lines.push(goalLine(g, goalCodes.get(g.id)!, invCodes));
    for (const b of g.billsFund?.upcoming.slice(0, 6) ?? []) {
      const code = `[B${++bill}]`;
      names[code] = b.name;
      lines.push(
        `  - planned payment ${code} ${rough(b.amount)} due ${monthYear(b.date)}${b.covered ? "" : " (not covered yet)"}`,
      );
    }
  }

  lines.push("", "Investments:");
  if (!investments.length) lines.push("- none yet.");
  for (const i of investments) {
    const linked = links.filter((l) => l.investmentId === i.id);
    const parts = [
      `${invCodes.get(i.id)} ${investmentLabel(i)}`,
      `asset class ${assetClassOf(i)}`,
      `worth ${rough(i.value)}`,
    ];
    if (i.monthlySip) parts.push(`SIP ${rough(i.monthlySip)} a month`);
    if (i.invested) parts.push(`invested ${rough(i.invested)}`);
    parts.push(
      `expected about ${i.returnPct ?? defaultReturn(i.kind, i.category)}% a year`,
    );
    parts.push(
      linked.length
        ? `counts toward ${linked.map((l) => `${goalCodes.get(l.goalId)}${l.percent < 100 ? ` (${l.percent}%)` : ""}`).join(", ")}`
        : "not linked to any goal",
    );
    lines.push(`- ${parts.join("; ")}.`);
  }

  const p = buildPortfolio(investments);
  if (p.total > 0) {
    const split = p.classes
      .map(
        (c) =>
          `${ASSET_CLASSES.find((a) => a.key === c.key)!.label} ${(c.share * 100).toFixed(0)}%`,
      )
      .join(", ");
    lines.push("", `Portfolio: ${rough(p.total)} in total; ${split}.`);
  }
  if (plan) {
    lines.push(
      `Money plan: ${rough(plan.lump)} available to invest now; ${rough(plan.monthly)} a month to invest in total.`,
    );
  }

  return {
    facts: lines.join("\n"),
    names,
    codeOf: Object.fromEntries([...invCodes, ...goalCodes]),
  };
}

/** Replaces codes like [G1] in the AI's reply with the user's own names. */
export function restoreNames(
  text: string,
  names: Record<string, string>,
): string {
  return text.replace(/\[(?:G|I|B)\d+\]/g, (code) =>
    names[code] ? `“${names[code]}”` : code,
  );
}

export const ASK_INSTRUCTIONS = `You help one person think through decisions about their own money in India, using only the facts given.

Rules:
- Refer to their goals, investments and planned payments only by the codes in square brackets, exactly as written, e.g. [G1], [I2], [B1]. Never invent codes.
- If you need something to answer well (how much, by when, whether it's urgent), ask one short question first instead of guessing.
- Keep answers short and plain: a few sentences or a short list. Use ₹ and Indian number formats.
- Explain the trade-offs: money not tied to any goal first; then goals that are furthest away or least important; keep the emergency fund for real emergencies; mention exit loads, ELSS 3-year lock-in, PPF/EPF limits, FD early-withdrawal penalties, and that equity sold within a year is taxed more, where relevant.
- Never recommend a specific fund, scheme, fund house (AMC), stock or company to buy. Talk only about kinds of funds.
- Use only the numbers in the facts. Never do your own sums or percentages; if a number you need isn't there, say so.
- When the facts include "The app's split", that is the answer: explain it in plain words, in that order, with those amounts. Don't move money between goals, don't add amounts, and don't give the same money to two goals.
- A one-time amount and a monthly amount are different: never use one to cover the other.
- You are not a registered investment adviser; for big or complex decisions suggest checking with one.`;
