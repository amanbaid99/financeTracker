"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  afterPayment,
  LOAN_TYPES,
  type Loan,
  type LoanType,
} from "@/lib/loans";
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
  // Loans show on Credit and feed pay-off goals.
  revalidatePath("/", "layout");
  return { ok: true, id };
}

const money = z.number().int().min(0).max(1e11);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pick a date");
const uuid = z.string().uuid();
const types = LOAN_TYPES.map((t) => t.value) as [LoanType, ...LoanType[]];

const loanSchema = z
  .object({
    id: uuid.optional(),
    name: z.string().trim().min(1, "add a name").max(60),
    type: z.enum(types),
    cardId: uuid.nullable(),
    principal: money.nullable(),
    takenOn: isoDate.nullable(),
    ratePct: z.number().min(0).max(60),
    emi: money.nullable(),
    totalEmis: z.number().int().min(1).max(600).nullable(),
    emiDay: z.number().int().min(1).max(31),
    billDay: z.number().int().min(1).max(31).nullable(),
    outstanding: money,
    asOf: isoDate,
    foreclosurePct: z.number().min(0).max(20).nullable(),
    foreclosureGst: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (!v.emi)
      ctx.addIssue({ code: "custom", path: ["EMI"], message: "add the EMI" });
  });

export async function saveLoan(
  input: z.input<typeof loanSchema>,
): Promise<Result> {
  try {
    const v = loanSchema.parse(input);
    const { supabase, userId } = await session();
    const row = {
      name: v.name,
      type: v.type,
      card_id: v.type === "card" ? v.cardId : null,
      principal: v.principal,
      taken_on: v.takenOn,
      rate: v.ratePct,
      emi: v.emi,
      total_emis: v.totalEmis,
      emi_day: v.emiDay,
      bill_day: v.type === "card" ? v.billDay : null,
      outstanding: v.outstanding,
      outstanding_as_of: v.asOf,
      foreclosure_pct: v.foreclosurePct,
      foreclosure_gst: v.foreclosureGst,
    };
    const res = v.id
      ? await supabase
          .from("loans")
          .update(row)
          .eq("id", v.id)
          .eq("user_id", userId)
          .select("id")
          .single()
      : await supabase
          .from("loans")
          .insert({ ...row, user_id: userId })
          .select("id")
          .single();
    if (res.error) throw new Error(res.error.message);
    return done(res.data.id);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteLoan(id: string): Promise<Result> {
  try {
    const loanId = uuid.parse(id);
    const { supabase, userId } = await session();
    const { error } = await supabase
      .from("loans")
      .delete()
      .eq("id", loanId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

const paySchema = z.object({ loanId: uuid, dueDate: isoDate });

async function loadLoan(
  supabase: Awaited<ReturnType<typeof session>>["supabase"],
  id: string,
): Promise<Loan> {
  const { data: l, error } = await supabase
    .from("loans")
    .select(
      "id, name, type, card_id, principal, taken_on, rate, emi, months_left, total_emis, emi_day, bill_day, first_emi, outstanding, outstanding_as_of, foreclosure_pct, foreclosure_gst",
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return {
    id: l.id,
    name: l.name,
    type: l.type as LoanType,
    cardId: l.card_id,
    principal: l.principal,
    takenOn: l.taken_on,
    ratePct: Number(l.rate),
    emi: l.emi,
    monthsLeft: l.months_left,
    totalEmis: l.total_emis,
    emiDay: l.emi_day,
    billDay: l.bill_day,
    firstEmi: l.first_emi,
    outstanding: l.outstanding,
    asOf: l.outstanding_as_of,
    foreclosurePct:
      l.foreclosure_pct === null ? null : Number(l.foreclosure_pct),
    foreclosureGst: l.foreclosure_gst,
    payments: [],
    goal: null,
  };
}

/** Marks one EMI paid: records it and takes it off what's owed. */
export async function markEmiPaid(
  input: z.input<typeof paySchema>,
): Promise<Result> {
  try {
    const v = paySchema.parse(input);
    const { supabase, userId } = await session();
    const loan = await loadLoan(supabase, v.loanId);
    const after = afterPayment(loan, v.dueDate);
    const { error: payErr } = await supabase.from("loan_payments").insert({
      user_id: userId,
      loan_id: loan.id,
      due_date: v.dueDate,
      amount: loan.emi ?? 0,
      prev_outstanding: loan.outstanding,
      prev_as_of: loan.asOf,
    });
    if (payErr)
      throw new Error(
        payErr.code === "23505"
          ? "That EMI is already marked paid."
          : payErr.message,
      );
    const { error } = await supabase
      .from("loans")
      .update({ outstanding: after.outstanding, outstanding_as_of: after.asOf })
      .eq("id", loan.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}

/** Undoes a payment: what's owed goes back to what it was before. */
export async function undoEmiPaid(
  input: z.input<typeof paySchema>,
): Promise<Result> {
  try {
    const v = paySchema.parse(input);
    const { supabase, userId } = await session();
    // Only the latest payment can be undone: earlier ones are built on.
    const { data: p, error } = await supabase
      .from("loan_payments")
      .select("id, due_date, prev_outstanding, prev_as_of")
      .eq("loan_id", v.loanId)
      .order("due_date", { ascending: false })
      .limit(1)
      .single();
    if (error) throw new Error(error.message);
    if (p.due_date !== v.dueDate)
      return { ok: false, error: "Undo the latest payment first." };
    const { error: upd } = await supabase
      .from("loans")
      .update({
        outstanding: p.prev_outstanding,
        outstanding_as_of: p.prev_as_of,
      })
      .eq("id", v.loanId)
      .eq("user_id", userId);
    if (upd) throw new Error(upd.message);
    const { error: del } = await supabase
      .from("loan_payments")
      .delete()
      .eq("id", p.id)
      .eq("user_id", userId);
    if (del) throw new Error(del.message);
    return done();
  } catch (e) {
    return fail(e);
  }
}
