"use server";

import { benefitDraftSchema, readCardBenefits } from "@/lib/card-benefits";
import { todayIST } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SPEND_CATEGORY_KEYS } from "@/lib/card-advisor";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; id?: string } | { ok: false; error: string };

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  return { supabase, userId: data.claims.sub };
}

function fail(e: unknown): Result {
  if (e instanceof z.ZodError) {
    const first = e.issues[0];
    return {
      ok: false,
      error: `Check ${first.path.join(" ") || "your input"}: ${first.message}`,
    };
  }
  return {
    ok: false,
    error: e instanceof Error ? e.message : "Something went wrong",
  };
}

function done(id?: string): Result {
  revalidatePath("/cards");
  revalidatePath("/goals");
  return { ok: true, id };
}

const money = z.number().int().min(0).max(1e12);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pick a date");

const cardSchema = z.object({
  createId: z.string().uuid().optional(),
  id: z.string().uuid().nullable(),
  label: z.string().trim().min(1, "name the card").max(40),
  annualFee: money.nullable(),
  statementDay: z.number().int().min(1).max(31).nullable().optional(),
  yearStart: isoDate.nullable(),
  rewards: z.string().trim().max(200).nullable(),
  benefits: z.array(z.string().trim().min(1).max(120)).max(30),
  reviewedBenefits: benefitDraftSchema.optional(),
  humanConfirmed: z.literal(true).optional(),
  bestFor: z.array(z.enum(SPEND_CATEGORY_KEYS)).max(8).optional(),
});

export async function saveCard(
  input: z.input<typeof cardSchema>,
): Promise<Result> {
  try {
    const v = cardSchema.parse(input);
    if (v.reviewedBenefits && !v.humanConfirmed)
      throw new Error("Check the brochure terms before saving.");
    const { supabase, userId } = await session();
    const row = {
      ...(v.reviewedBenefits
        ? {
            feature_details: {
              ...v.reviewedBenefits,
              version: 1,
              reviewedAt: new Date().toISOString(),
            },
          }
        : {}),
      label: v.label,
      annual_fee: v.annualFee,
      ...(v.statementDay !== undefined
        ? { statement_day: v.statementDay }
        : {}),
      year_start: v.yearStart,
      rewards: v.rewards || null,
      benefits: v.benefits,
      ...(v.bestFor ? { best_for: [...new Set(v.bestFor)] } : {}),
    };
    const res = v.id
      ? await supabase
          .from("credit_cards")
          .update(row)
          .eq("id", v.id)
          .eq("user_id", userId)
          .select("id")
          .single()
      : await supabase
          .from("credit_cards")
          [v.createId ? "upsert" : "insert"]({
            ...row,
            user_id: userId,
            ...(v.createId ? { id: v.createId } : {}),
          })
          .select("id")
          .single();
    if (res.error) throw new Error(res.error.message);
    return done(res.data.id);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCard(id: string): Promise<Result> {
  try {
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("credit_cards")
      .delete()
      .eq("id", z.string().uuid().parse(id))
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

const milestoneSchema = z
  .object({
    createId: z.string().uuid().optional(),
    id: z.string().uuid().nullable(),
    cardId: z.string().uuid(),
    name: z.string().trim().min(1, "name the milestone").max(80),
    target: money.min(1, "add the spend target"),
    period: z.enum(["card_year", "calendar_year", "quarter", "month", "once"]),
    deadline: isoDate.nullable(),
    reward: z.string().trim().max(120).nullable(),
  })
  .refine((v) => v.period !== "once" || v.deadline, {
    message: "pick the date it must be done by",
    path: ["deadline"],
  });

export async function saveMilestone(
  input: z.input<typeof milestoneSchema>,
): Promise<Result> {
  try {
    const v = milestoneSchema.parse(input);
    const { supabase, userId } = await session();
    const row = {
      card_id: v.cardId,
      name: v.name,
      target: v.target,
      period: v.period,
      deadline: v.period === "once" ? v.deadline : null,
      reward: v.reward || null,
    };
    const res = v.id
      ? await supabase
          .from("card_milestones")
          .update(row)
          .eq("id", v.id)
          .eq("user_id", userId)
          .select("id")
          .single()
      : await supabase
          .from("card_milestones")
          [v.createId ? "upsert" : "insert"]({
            ...row,
            user_id: userId,
            ...(v.createId ? { id: v.createId } : {}),
          })
          .select("id")
          .single();
    if (res.error) throw new Error(res.error.message);
    return done(res.data.id);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMilestone(id: string): Promise<Result> {
  try {
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("card_milestones")
      .delete()
      .eq("id", z.string().uuid().parse(id))
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

const billSchema = z.object({
  id: z.string().uuid().nullable(),
  cardId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "pick the statement month"),
  amount: money,
  dueDate: isoDate.nullable(),
  paid: z.boolean(),
  note: z.string().trim().max(120).nullable(),
});

/** Logs a month's bill. A month already logged must be edited instead. */
export async function saveBill(
  input: z.input<typeof billSchema>,
): Promise<Result> {
  try {
    const v = billSchema.parse(input);
    const { supabase, userId } = await session();
    const row = {
      card_id: v.cardId,
      month: `${v.month}-01`,
      amount: v.amount,
      due_date: v.dueDate,
      paid: v.paid,
      note: v.note || null,
    };
    const res = v.id
      ? await supabase
          .from("card_bills")
          .update(row)
          .eq("id", v.id)
          .eq("user_id", userId)
          .select("id")
          .single()
      : await supabase
          .from("card_bills")
          .insert({ ...row, user_id: userId })
          .select("id")
          .single();
    if (res.error) {
      if (res.error.code === "23505")
        throw new Error("That month already has a bill. Edit it instead.");
      throw new Error(res.error.message);
    }
    return done(res.data.id);
  } catch (e) {
    return fail(e);
  }
}

export async function setBillPaid(input: {
  id: string;
  paid: boolean;
}): Promise<Result> {
  try {
    const v = z
      .object({ id: z.string().uuid(), paid: z.boolean() })
      .parse(input);
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("card_bills")
      .update({ paid: v.paid })
      .eq("id", v.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBill(id: string): Promise<Result> {
  try {
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("card_bills")
      .delete()
      .eq("id", z.string().uuid().parse(id))
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

/** A confirmed visit log, not an automatic bank feed or eligibility check. */
export async function logLoungeVisit(input: {
  cardId: string;
  ruleId: string;
  date: string;
  visits: number;
}): Promise<Result> {
  try {
    const v = z
      .object({
        cardId: z.string().uuid(),
        ruleId: z.string().min(1).max(80),
        date: z.string().date(),
        visits: z.number().int().min(1).max(99),
      })
      .parse(input);
    if (v.date > todayIST()) throw new Error("Use today or a past visit date.");
    const { supabase, userId } = await session();
    const card = await supabase
      .from("credit_cards")
      .select("feature_details")
      .eq("id", v.cardId)
      .eq("user_id", userId)
      .single();
    if (card.error) throw new Error("Card not found.");
    const b = readCardBenefits(card.data.feature_details);
    if (!b?.lounges.some((r) => r.id === v.ruleId))
      throw new Error("Review this lounge benefit first.");
    const res = await supabase.from("card_lounge_visits").insert({
      user_id: userId,
      card_id: v.cardId,
      rule_id: v.ruleId,
      visited_on: v.date,
      visits: v.visits,
    });
    if (res.error) throw new Error(res.error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}
export async function deleteLoungeVisit(id: string): Promise<Result> {
  try {
    const { supabase, userId } = await session();
    const res = await supabase
      .from("card_lounge_visits")
      .delete()
      .eq("id", z.string().uuid().parse(id))
      .eq("user_id", userId)
      .select("id")
      .single();
    if (res.error) throw new Error("Couldn't remove the visit. Try again.");
    return done();
  } catch (e) {
    return fail(e);
  }
}
