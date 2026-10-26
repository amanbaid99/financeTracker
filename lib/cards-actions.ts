"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SPEND_CATEGORY_KEYS } from "@/lib/card-advisor";
import { todayIST } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; id?: string } | { ok: false; error: string };

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, userId: data.user.id };
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
  return { ok: true, id };
}

const money = z.number().int().min(0).max(1e12);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pick a date");

const cardSchema = z.object({
  id: z.string().uuid().nullable(),
  label: z.string().trim().min(1, "name the card").max(40),
  annualFee: money.nullable(),
  yearStart: isoDate.nullable(),
  rewards: z.string().trim().max(200).nullable(),
  benefits: z.array(z.string().trim().min(1).max(120)).max(30),
  bestFor: z.array(z.enum(SPEND_CATEGORY_KEYS)).max(8).optional(),
});

export async function saveCard(
  input: z.input<typeof cardSchema>,
): Promise<Result> {
  try {
    const v = cardSchema.parse(input);
    const { supabase, userId } = await session();
    const row = {
      label: v.label,
      annual_fee: v.annualFee,
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
          .insert({ ...row, user_id: userId })
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
    id: z.string().uuid().nullable(),
    cardId: z.string().uuid(),
    name: z.string().trim().min(1, "name the milestone").max(80),
    target: money.min(1, "add the spend target"),
    period: z.enum(["card_year", "calendar_year", "quarter", "month", "once"]),
    deadline: isoDate.nullable(),
    reward: z.string().trim().max(120).nullable(),
    spent: money,
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
      spent: v.spent,
      spent_as_of: todayIST(),
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
          .insert({ ...row, user_id: userId })
          .select("id")
          .single();
    if (res.error) throw new Error(res.error.message);
    return done(res.data.id);
  } catch (e) {
    return fail(e);
  }
}

/** Updates the spend counted so far in the milestone's current period. */
export async function updateMilestoneSpend(input: {
  id: string;
  spent: number;
}): Promise<Result> {
  try {
    const v = z.object({ id: z.string().uuid(), spent: money }).parse(input);
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("card_milestones")
      .update({ spent: v.spent, spent_as_of: todayIST() })
      .eq("id", v.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
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
