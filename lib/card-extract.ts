// Reads card features out of a document with AI, then checks the result.
// Each fact is "confirmed" only when at least two AI readings agree on it
// and it can be found in the document itself. Everything else is shown for
// the person to check. Nothing here saves anything.

import { SPEND_CATEGORY_KEYS, type SpendCategory } from "@/lib/card-advisor";
import type { Period } from "@/lib/cards";

const PERIODS: Period[] = [
  "card_year",
  "calendar_year",
  "quarter",
  "month",
  "once",
];

export interface MilestoneDraft {
  name: string;
  target: number;
  period: Period;
  reward: string | null;
}

export interface Extracted {
  cardName: string | null;
  annualFee: number | null;
  rewards: string | null;
  benefits: string[];
  milestones: MilestoneDraft[];
  bestFor: SpendCategory[];
}

export const EXTRACT_PROMPT = `You read Indian credit card feature documents (key facts, MITC, benefit guides) or a person's own description of their card.
Use only facts written in the text. Never guess or use outside knowledge. Leave out anything not stated.
Reply with JSON only:
{"card_name": string|null,
 "annual_fee": number|null,  // rupees, without GST; null if not stated
 "rewards": string|null,     // one short line on how points or cashback are earned and worth, max 150 characters
 "benefits": string[],       // up to 12 short lines, max 100 characters each, keep numbers exactly as written
 "milestones": [{"name": string, "target": number, "period": "card_year"|"calendar_year"|"quarter"|"month"|"once", "reward": string}],
 "best_for": string[]}       // only from: ${SPEND_CATEGORY_KEYS.join(", ")}
A fee waived after spending an amount in a year is a milestone named "Annual fee waiver" with reward "Annual fee waived".
Write amounts as plain numbers of rupees: 8 lakh is 800000.`;

// ---------------------------------------------------------------------------
// Reading the AI's JSON
// ---------------------------------------------------------------------------

const str = (v: unknown, max: number) =>
  typeof v === "string" && v.trim()
    ? v.trim().replace(/\s+/g, " ").slice(0, max)
    : null;
const rupees = (v: unknown) => {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? Number(v.replace(/[₹,\s]/g, ""))
        : NaN;
  return Number.isFinite(n) && n >= 0 && n < 1e10 ? Math.round(n) : null;
};

/** The AI's reply as clean data, or null when it isn't usable JSON. */
export function parseExtraction(reply: string): Extracted | null {
  let raw: Record<string, unknown>;
  try {
    const json = reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1);
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    cardName: str(raw.card_name, 40),
    annualFee: rupees(raw.annual_fee),
    rewards: str(raw.rewards, 200),
    benefits: [
      ...new Set(
        list(raw.benefits)
          .map((b) => str(b, 120))
          .filter((b): b is string => !!b),
      ),
    ].slice(0, 15),
    milestones: list(raw.milestones)
      .map((m) => {
        const o = (m ?? {}) as Record<string, unknown>;
        const target = rupees(o.target);
        const period = PERIODS.includes(o.period as Period)
          ? (o.period as Period)
          : "card_year";
        const name = str(o.name, 80);
        return target && name
          ? { name, target, period, reward: str(o.reward, 120) }
          : null;
      })
      .filter((m): m is MilestoneDraft => !!m)
      .slice(0, 8),
    bestFor: [
      ...new Set(
        list(raw.best_for).filter((c): c is SpendCategory =>
          SPEND_CATEGORY_KEYS.includes(c as SpendCategory),
        ),
      ),
    ],
  };
}

// ---------------------------------------------------------------------------
// Checking against the document
// ---------------------------------------------------------------------------

/** Every amount written in the text, with lakh, crore and k understood. */
export function amountsIn(text: string): Set<number> {
  const out = new Set<number>();
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|crores?|cr\b|k\b)?/gi;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    const unit = (m[2] ?? "").toLowerCase();
    const mult = unit.startsWith("l")
      ? 1e5
      : unit.startsWith("c")
        ? 1e7
        : unit === "k"
          ? 1e3
          : 1;
    out.add(Math.round(n * mult * 100) / 100);
  }
  return out;
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );

/** True when the line's numbers and most of its words are in the document. */
export function foundIn(
  line: string,
  doc: string,
  docAmounts = amountsIn(doc),
): boolean {
  if (![...amountsIn(line)].every((n) => docAmounts.has(n))) return false;
  const w = [...words(line)];
  if (!w.length) return true;
  const docWords = words(doc);
  return w.filter((x) => docWords.has(x)).length / w.length >= 0.5;
}

// ---------------------------------------------------------------------------
// Comparing readings
// ---------------------------------------------------------------------------

export type Check = "confirmed" | "check";
export interface Item<T> {
  value: T;
  check: Check;
  why: string;
}
export interface Review {
  cardName: Item<string> | null;
  annualFee: Item<number> | null;
  rewards: Item<string> | null;
  benefits: Item<string>[];
  milestones: Item<MilestoneDraft>[];
  bestFor: Item<SpendCategory>[];
  readings: number;
}

const sameNumbers = (a: string, b: string) => {
  const x = [...amountsIn(a)].sort().join();
  return x === [...amountsIn(b)].sort().join();
};
const similar = (a: string, b: string) => {
  if (!sameNumbers(a, b)) return false;
  const wa = words(a);
  const wb = words(b);
  const inter = [...wa].filter((w) => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union === 0 || inter / union >= 0.3;
};

function verdict(
  support: number,
  readings: number,
  grounded: boolean,
  groundable = true,
): Pick<Item<unknown>, "check" | "why"> {
  if (readings < 2)
    return {
      check: "check",
      why: "Only one reading came back, so check this.",
    };
  if (support < 2)
    return { check: "check", why: "The readings didn't agree on this." };
  if (groundable && !grounded)
    return { check: "check", why: "Not found word for word in the document." };
  return {
    check: "confirmed",
    why: "Readings agree and it's in the document.",
  };
}

/** Merges readings: each fact with how many readings back it up. */
export function combine(readings: Extracted[], doc: string): Review {
  const n = readings.length;
  const docAmounts = amountsIn(doc);

  function scalar<T>(
    pick: (e: Extracted) => T | null,
    eq: (a: T, b: T) => boolean,
    grounded: (v: T) => boolean,
  ): Item<T> | null {
    const values = readings.map(pick).filter((v): v is T => v !== null);
    if (!values.length) return null;
    let best = values[0];
    let bestCount = 0;
    for (const v of values) {
      const c = values.filter((w) => eq(v, w)).length;
      if (c > bestCount) [best, bestCount] = [v, c];
    }
    return { value: best, ...verdict(bestCount, n, grounded(best)) };
  }

  function list<T>(
    pick: (e: Extracted) => T[],
    eq: (a: T, b: T) => boolean,
    grounded: (v: T) => boolean,
    groundable = true,
  ): Item<T>[] {
    const out: { value: T; support: number }[] = [];
    readings.forEach((r) => {
      const seen = new Set<number>();
      for (const v of pick(r)) {
        const i = out.findIndex((o) => eq(o.value, v));
        if (i === -1) out.push({ value: v, support: 1 });
        else if (!seen.has(i)) out[i].support += 1;
        seen.add(i === -1 ? out.length - 1 : i);
      }
    });
    return out.map((o) => ({
      value: o.value,
      ...verdict(o.support, n, grounded(o.value), groundable),
    }));
  }

  return {
    readings: n,
    cardName: scalar(
      (e) => e.cardName,
      (a, b) => [...words(a)].some((w) => words(b).has(w)),
      (v) => foundIn(v, doc, docAmounts),
    ),
    annualFee: scalar(
      (e) => e.annualFee,
      (a, b) => a === b,
      (v) => v === 0 || docAmounts.has(v),
    ),
    rewards: scalar(
      (e) => e.rewards,
      similar,
      (v) => foundIn(v, doc, docAmounts),
    ),
    benefits: list(
      (e) => e.benefits,
      similar,
      (v) => foundIn(v, doc, docAmounts),
    ),
    milestones: list(
      (e) => e.milestones,
      (a, b) => a.target === b.target && a.period === b.period,
      (v) => docAmounts.has(v.target),
    ),
    // Categories are a judgement, not a quote, so agreement is enough.
    bestFor: list(
      (e) => e.bestFor,
      (a, b) => a === b,
      () => true,
      false,
    ),
  };
}

/** True when the readings differ on something a third reading could settle. */
export function needsTieBreak(readings: Extracted[]): boolean {
  if (readings.length !== 2) return false;
  const [a, b] = readings;
  const targets = (e: Extracted) =>
    e.milestones
      .map((m) => `${m.target}:${m.period}`)
      .sort()
      .join();
  return a.annualFee !== b.annualFee || targets(a) !== targets(b);
}

/** Masks card numbers, emails, phone numbers and PAN-like codes. */
export function maskPersonal(text: string): string {
  return text
    .replace(/\b\d(?:[ -]?\d){12,18}\b/g, "[number]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/(?<!\d)(?:\+?91[ -]?)?[6-9]\d{9}(?!\d)/g, "[phone]")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[id]");
}
