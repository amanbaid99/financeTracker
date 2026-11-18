"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data";
import { todayIST } from "@/lib/dates";

export async function snoozeUpdate(key: string) {
  const parsed = z.string().min(1).max(100).safeParse(key);
  if (!parsed.success) return { ok: false, error: "Invalid update." };
  const { supabase } = await requireUser();
  const tomorrow = new Date(`${todayIST()}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const { error } = await supabase.rpc("snooze_update", {
    update_key: parsed.data,
    until_day: tomorrow.toISOString().slice(0, 10),
  });
  if (error)
    return { ok: false, error: "Couldn't postpone this update. Try again." };
  revalidatePath("/goals");
  revalidatePath("/today");
  return { ok: true };
}

export async function confirmLoanBalance(input: {
  id: string;
  outstanding: number;
  principal: number | null;
}) {
  const v = z
    .object({
      id: z.string().uuid(),
      outstanding: z.number().int().min(0).max(1e11),
      principal: z.number().int().positive().max(1e11).nullable(),
    })
    .safeParse(input);
  if (!v.success)
    return { ok: false, error: "Check the amounts and try again." };
  const { supabase, user } = await requireUser();
  const today = todayIST();
  const { error } = await supabase
    .from("loans")
    .update({
      outstanding: v.data.outstanding,
      principal: v.data.principal,
      outstanding_as_of: today,
      balance_confirmed_on: today,
    })
    .eq("id", v.data.id)
    .eq("user_id", user.id)
    .select("id")
    .single();
  if (error)
    return { ok: false, error: "Couldn't save the balance. Try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}
