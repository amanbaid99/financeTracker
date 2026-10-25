// Turns a read statement into review rows: which existing investment each
// holding matches, its category, its SIP, and anything to ask the user.
// Pure functions so they can be tested without a database or AI.

import { z } from "zod";
import { asKind, type Kind } from "@/lib/instruments";
import type { Investment } from "@/lib/tracker";
import { placeFromKey, placeFromName } from "./categories";

export const parsedHoldingSchema = z.object({
  key: z.string().min(1).max(80),
  kind: z.enum(["mutual_fund", "stock", "other", "nps"]),
  name: z.string().max(200),
  isin: z.string().max(40).nullable(),
  amc: z.string().max(200).nullable().optional(),
  fundType: z.string().max(40).nullable().optional(),
  units: z.number(),
  nav: z.number(),
  value: z.number().int().min(0).max(1e13),
  navDate: z.string().nullable(),
  sipMonthly: z.number().int().min(0).nullable(),
  lastSipDate: z.string().nullable(),
  count: z.number().int().min(1).optional(),
  issues: z.array(z.string().max(300)).max(50),
});

export const parsedStatementSchema = z.object({
  source: z.string().max(20),
  detailed: z.boolean(),
  statementDate: z.string().nullable(),
  holdings: z.array(parsedHoldingSchema).min(1).max(300),
  warnings: z.array(z.string().max(500)).max(50),
});

export type ParsedHolding = z.infer<typeof parsedHoldingSchema>;
export type ParsedStatement = z.infer<typeof parsedStatementSchema>;

export type ExistingInvestment = Investment & { isin: string | null };

/** Something the user must answer before the row can be saved. */
export type Question =
  | { kind: "confirm_match"; text: string }
  | { kind: "which_match"; text: string }
  | { kind: "sip_stopped"; text: string; previousSip: number }
  | { kind: "category"; text: string };

export type CategoryHow = "yours" | "from its name" | "two models agreed" | "checked by a third model" | "ask";

export interface ReviewRow {
  key: string;
  name: string;
  isin: string | null;
  kind: Kind;
  /** Null when the user needs to pick one. */
  category: string | null;
  categoryHow: CategoryHow;
  value: number;
  /** SIP to save; null keeps whatever the matched investment has. */
  sip: number | null;
  /** True when the SIP comes from the statement's transactions. */
  sipFromStatement: boolean;
  issues: string[];
  match: { id: string; name: string; value: number; sip: number; how: "isin" | "name" } | null;
  /** Other existing investments it might be, best first (for name matches). */
  candidates: { id: string; name: string }[];
  /** Questions the user must answer before saving. */
  questions: Question[];
}

const STOP = new Set([
  "direct", "regular", "plan", "growth", "option", "fund", "idcw", "dividend", "reinvestment",
  "payout", "the", "of", "scheme", "g", "dir", "gr",
]);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9& ]+/g, " ")
      .split(/\s+/)
      .filter((t) => t && !STOP.has(t)),
  );
}

/** How alike two fund names are, 0 to 1. */
export function nameSimilarity(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const t of x) if (y.has(t)) both++;
  return both / (x.size + y.size - both);
}

const label = (i: Investment) => i.name?.trim() || "Unnamed investment";
const sameFamily = (a: Kind, b: string) => (a === "mutual_fund") === (asKind(b) === "mutual_fund");

export function buildReview(statement: ParsedStatement, existing: ExistingInvestment[]): ReviewRow[] {
  const used = new Set<string>();
  const rows: ReviewRow[] = [];

  // Exact matches first so a name match never takes an investment an ISIN owns.
  const byIsin = new Map(existing.filter((e) => e.isin).map((e) => [e.isin!.toUpperCase(), e]));
  const order = [...statement.holdings].sort(
    (a, b) => Number(!byIsin.has(a.key.toUpperCase())) - Number(!byIsin.has(b.key.toUpperCase())),
  );

  for (const h of order) {
    const fixed = placeFromKey(h.key);
    const kind: Kind = fixed?.kind ?? (h.kind === "mutual_fund" ? "mutual_fund" : asKind(h.kind));
    const questions: Question[] = [];
    let match: ReviewRow["match"] = null;
    let candidates: ReviewRow["candidates"] = [];

    const exact = byIsin.get(h.key.toUpperCase()) ?? (h.isin ? byIsin.get(h.isin.toUpperCase()) : undefined);
    if (exact && !used.has(exact.id)) {
      match = { id: exact.id, name: label(exact), value: exact.value, sip: exact.monthlySip, how: "isin" };
      used.add(exact.id);
    } else {
      const scored = existing
        .filter((e) => !e.isin && !used.has(e.id) && sameFamily(kind, e.kind))
        .map((e) => ({ e, score: nameSimilarity(h.name, e.name ?? "") }))
        .filter((x) => x.score >= 0.5)
        .sort((a, b) => b.score - a.score);
      if (scored.length) {
        const best = scored[0].e;
        match = { id: best.id, name: label(best), value: best.value, sip: best.monthlySip, how: "name" };
        candidates = scored.map((x) => ({ id: x.e.id, name: label(x.e) }));
        used.add(best.id);
        questions.push(
          scored.length > 1 && scored[1].score >= scored[0].score - 0.1
            ? { kind: "which_match", text: "Which of your investments is this?" }
            : { kind: "confirm_match", text: `Is this your “${label(best)}”?` },
        );
      }
    }

    // Category: keep yours, else from the name, else ask (AI fills some later).
    const matched = match ? existing.find((e) => e.id === match!.id) : undefined;
    let category: string | null = null;
    let categoryHow: CategoryHow = "ask";
    if (fixed) {
      category = fixed.category;
      categoryHow = "from its name";
    } else if (matched?.category && matched.category !== "other" && matched.kind === kind) {
      category = matched.category;
      categoryHow = "yours";
    } else {
      const placed = placeFromName(h.name, h.fundType ?? null);
      if (placed) {
        category = placed.category;
        categoryHow = "from its name";
      }
    }

    // SIP: a detailed statement shows the SIPs actually running.
    let sip: number | null = null;
    let sipFromStatement = false;
    if (statement.detailed && kind === "mutual_fund") {
      sip = h.sipMonthly ?? 0;
      sipFromStatement = true;
      if (match && match.sip > 0 && sip === 0) {
        questions.push({
          kind: "sip_stopped",
          text: `No SIP into this fund lately. Has your ₹${match.sip.toLocaleString("en-IN")} a month SIP stopped?`,
          previousSip: match.sip,
        });
      }
    }

    rows.push({
      key: h.key,
      name: h.name,
      isin: h.isin ?? (fixed ? h.key : null),
      kind,
      category,
      categoryHow,
      value: h.value,
      sip,
      sipFromStatement,
      issues: h.issues,
      match,
      candidates,
      questions,
    });
  }
  // Back to statement order.
  const pos = new Map(statement.holdings.map((h, i) => [h.key, i]));
  return rows.sort((a, b) => pos.get(a.key)! - pos.get(b.key)!);
}

/** Fills categories the AI settled; anything left gets a question. */
export function applyAiCategories(
  rows: ReviewRow[],
  verdicts: Map<string, { category: string; how: "two models agreed" | "checked by a third model" }>,
): ReviewRow[] {
  return rows.map((r) => {
    if (r.category) return r;
    const v = verdicts.get(r.key);
    if (v) return { ...r, category: v.category, kind: v.category === "gold" ? "gold" : r.kind, categoryHow: v.how };
    return { ...r, questions: [...r.questions, { kind: "category", text: "What kind of fund is this?" }] };
  });
}
