"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { FUND_CATEGORIES, KINDS } from "@/lib/instruments";
import { createClient } from "@/lib/supabase/server";
import { freePercent } from "@/lib/tracker";
import { aiCategories } from "./ai-categories";
import {
  applyAiCategories,
  buildReview,
  parsedStatementSchema,
  type ExistingInvestment,
  type ParsedStatement,
  type ReviewRow,
} from "./review";

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, userId: data.user.id };
}

export type PrepareResult =
  | {
      ok: true;
      source: string;
      detailed: boolean;
      statementDate: string | null;
      warnings: string[];
      rows: ReviewRow[];
      goals: { id: string; name: string }[];
      /** The user's investments, for "this is…" choices. */
      investments: { id: string; name: string; isFund: boolean; value: number; sip: number; category: string | null }[];
    }
  | { ok: false; error: string };

/** Matches a read statement to the user's investments and settles categories. */
export async function prepareImport(input: ParsedStatement): Promise<PrepareResult> {
  const parsed = parsedStatementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "The statement came back in an unexpected shape. Try again." };
  const statement = parsed.data;
  const { supabase } = await session();
  const [holdings, goals] = await Promise.all([
    supabase.from("holdings").select("id, kind, name, category, current_value, monthly_sip, expected_return_pct, isin"),
    supabase.from("goals").select("id, name").order("created_at"),
  ]);
  if (holdings.error || goals.error) return { ok: false, error: "Couldn't load your investments. Try again." };
  const existing: ExistingInvestment[] = holdings.data.map((h) => ({
    id: h.id,
    kind: h.kind,
    name: h.name,
    category: h.category,
    value: h.current_value,
    monthlySip: h.monthly_sip ?? 0,
    returnPct: h.expected_return_pct === null ? null : Number(h.expected_return_pct),
    isin: h.isin,
  }));

  let rows = buildReview(statement, existing);
  const unplaced = rows.filter((r) => !r.category);
  const verdicts = await aiCategories(unplaced.map((r) => r.name));
  const settled = new Map<string, NonNullable<(typeof verdicts)[number]>>();
  unplaced.forEach((r, i) => {
    const v = verdicts[i];
    if (v) settled.set(r.key, v);
  });
  rows = applyAiCategories(rows, settled);

  return {
    ok: true,
    source: statement.source,
    detailed: statement.detailed,
    statementDate: statement.statementDate,
    warnings: statement.warnings,
    rows,
    goals: goals.data,
    investments: existing.map((e) => ({
      id: e.id,
      name: e.name?.trim() || "Unnamed investment",
      isFund: e.kind === "mutual_fund",
      value: e.value,
      sip: e.monthlySip,
      category: e.category,
    })),
  };
}

const fundValues = new Set(FUND_CATEGORIES.map((c) => c.value));
const money = z.number().int().min(0).max(1e13);

const choiceSchema = z
  .object({
    action: z.enum(["update", "add", "skip"]),
    investmentId: z.string().uuid().nullable(),
    name: z.string().trim().min(1).max(200),
    isin: z.string().max(40).nullable(),
    kind: z.enum(KINDS),
    category: z.string().max(40).nullable(),
    value: money,
    sip: money.nullable(),
    goalId: z.string().uuid().nullable(),
  })
  .superRefine((c, ctx) => {
    if (c.action === "update" && !c.investmentId) ctx.addIssue({ code: "custom", message: "pick which investment" });
    if (c.action !== "skip" && c.kind === "mutual_fund" && !(c.category && fundValues.has(c.category))) {
      ctx.addIssue({ code: "custom", message: `pick what kind of fund “${c.name}” is` });
    }
  });

export type ImportChoice = z.input<typeof choiceSchema>;

/** Saves the reviewed rows: updates matched investments, adds new ones, links goals. */
export async function applyImport(
  choices: ImportChoice[],
): Promise<{ ok: true; updated: number; added: number } | { ok: false; error: string }> {
  const parsed = z.array(choiceSchema).max(300).safeParse(choices);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ? `Please ${first.message}.` : "Check your choices and try again." };
  }
  const { supabase, userId } = await session();
  const links = await supabase.from("goal_allocations").select("goal_id, holding_id, percent");
  if (links.error) return { ok: false, error: links.error.message };
  const current = links.data.map((l) => ({ goalId: l.goal_id, investmentId: l.holding_id, percent: Number(l.percent) }));
  const now = new Date().toISOString();
  let updated = 0;
  let added = 0;

  try {
    for (const c of parsed.data) {
      if (c.action === "skip") continue;
      const category =
        c.kind === "mutual_fund" ? c.category : c.kind === "stock" ? "direct_equity" : (c.category ?? c.kind);
      let id: string;
      if (c.action === "update") {
        const patch: {
          current_value: number;
          isin: string | null;
          updated_at: string;
          monthly_sip?: number | null;
          category?: string | null;
        } = { current_value: c.value, isin: c.isin, updated_at: now };
        if (c.sip !== null) patch.monthly_sip = c.sip || null;
        if (c.kind === "mutual_fund") patch.category = category;
        const res = await supabase
          .from("holdings")
          .update(patch)
          .eq("id", c.investmentId!)
          .eq("user_id", userId)
          .select("id")
          .single();
        if (res.error) throw new Error(res.error.message);
        id = res.data.id;
        updated++;
      } else {
        const res = await supabase
          .from("holdings")
          .insert({
            user_id: userId,
            kind: c.kind,
            name: c.name.slice(0, 80),
            category,
            current_value: c.value,
            monthly_sip: c.sip || null,
            isin: c.isin,
            source: "cas",
          })
          .select("id")
          .single();
        if (res.error) throw new Error(res.error.message);
        id = res.data.id;
        added++;
      }
      if (c.goalId && !current.some((l) => l.goalId === c.goalId && l.investmentId === id)) {
        const free = freePercent(id, current);
        if (free >= 1) {
          const ins = await supabase
            .from("goal_allocations")
            .insert({ user_id: userId, goal_id: c.goalId, holding_id: id, percent: free });
          if (ins.error) throw new Error(ins.error.message);
          current.push({ goalId: c.goalId, investmentId: id, percent: free });
        }
      }
    }
  } catch (e) {
    revalidatePath("/", "layout");
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong while saving." };
  }
  revalidatePath("/", "layout");
  return { ok: true, updated, added };
}
