"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data";
import { priceUpdates, type PriceSkip, type PriceUpdate } from "@/lib/prices";
import { fetchAmfiText } from "@/lib/radar/etf-data";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** New values for holdings with units and an ISIN, to review before saving. */
export async function checkPrices(): Promise<
  Result<{ updates: PriceUpdate[]; skipped: PriceSkip[] }>
> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("holdings")
    .select("id, name, kind, current_value, units, isin")
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't load your holdings." };
  let file: string;
  try {
    file = await fetchAmfiText();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Prices are unavailable.",
    };
  }
  const result = priceUpdates(
    (data ?? []).map((h) => ({
      id: h.id,
      name: h.name ?? "Holding",
      kind: h.kind,
      value: Number(h.current_value),
      units: h.units == null ? null : Number(h.units),
      isin: h.isin,
    })),
    file,
  );
  return { ok: true, ...result };
}

const applySchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      value: z.number().int().min(0).max(1e13),
    }),
  )
  .min(1)
  .max(200);

/** Saves the values the owner confirmed. */
export async function applyPrices(
  input: { id: string; value: number }[],
): Promise<Result<{ saved: number }>> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nothing to save." };
  const { supabase, user } = await requireUser();
  const now = new Date().toISOString();
  for (const u of parsed.data) {
    const { error } = await supabase
      .from("holdings")
      .update({ current_value: u.value, updated_at: now })
      .eq("id", u.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: "Couldn't save. Try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true, saved: parsed.data.length };
}
