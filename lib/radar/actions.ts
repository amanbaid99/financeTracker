"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { todayIST } from "@/lib/dates";
import type { Json } from "@/lib/supabase/database.types";
import { watchSchema } from "./contracts";
import { analyseRadar } from "./analysis";
import {
  loadRadar,
  radarInstruments,
  radarProvider,
  requireRadar,
} from "./data";

export async function searchRadar(query: string) {
  await requireRadar();
  const parsed = z.string().trim().min(2).max(80).safeParse(query);
  if (!parsed.success)
    return {
      ok: false as const,
      error: "Enter at least two characters of a name, symbol or ISIN.",
    };
  const result = await radarInstruments();
  if (!result.ok) return result;
  const q = parsed.data.toLocaleLowerCase();
  return {
    ok: true as const,
    items: result.instruments
      .filter((i) =>
        [i.name, i.symbol, i.isin ?? ""].some((s) =>
          s.toLocaleLowerCase().includes(q),
        ),
      )
      .slice(0, 20),
  };
}

export async function addRadar(input: z.input<typeof watchSchema>) {
  const { supabase, user } = await requireRadar();
  const v = watchSchema.safeParse(input);
  if (!v.success)
    return { ok: false, error: "Check the instrument and thresholds." };
  const list = await radarInstruments();
  if (!list.ok) return list;
  const instrument = list.instruments.find(
    (i) => i.exchange === v.data.exchange && i.securityId === v.data.securityId,
  );
  if (!instrument)
    return {
      ok: false,
      error: "This instrument is no longer available. Search again.",
    };
  const { count } = await supabase
    .from("radar_watchlist")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= 30)
    return {
      ok: false,
      error: "Keep up to 30 instruments in your personal watchlist.",
    };
  const { error } = await supabase.from("radar_watchlist").insert({
    user_id: user.id,
    exchange: instrument.exchange,
    security_id: instrument.securityId,
    symbol: instrument.symbol,
    name: instrument.name,
    isin: instrument.isin,
    asset_type: v.data.assetType,
    price_below: v.data.priceBelow,
    drawdown_pct: v.data.drawdownPct,
  });
  if (error)
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "That instrument is already on your watchlist."
          : "Couldn't save this instrument. Try again.",
    };
  revalidatePath("/radar");
  return { ok: true };
}

export async function saveRadarRules(input: {
  id: string;
  priceBelow: number | null;
  drawdownPct: number | null;
}) {
  const { supabase, user } = await requireRadar();
  const parsed = watchSchema
    .pick({ priceBelow: true, drawdownPct: true })
    .extend({ id: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the thresholds." };
  const v = parsed.data;
  const { error } = await supabase
    .from("radar_watchlist")
    .update({ price_below: v.priceBelow, drawdown_pct: v.drawdownPct })
    .eq("id", v.id)
    .eq("user_id", user.id)
    .select("id")
    .single();
  if (error) return { ok: false, error: "Couldn't save the thresholds." };
  revalidatePath("/radar", "layout");
  return { ok: true };
}

export async function removeRadar(id: string) {
  const { supabase, user } = await requireRadar();
  if (!z.string().uuid().safeParse(id).success)
    return { ok: false, error: "Invalid watchlist item." };
  const { error } = await supabase
    .from("radar_watchlist")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .single();
  if (error) return { ok: false, error: "Couldn't remove this instrument." };
  revalidatePath("/radar", "layout");
  return { ok: true };
}

export async function refreshRadar(id: string) {
  await requireRadar();
  const { items, history } = await loadRadar();
  const item = items.find((i) => i.id === id);
  if (!item) return { ok: false, error: "Instrument not found." };
  const last = history.find((s) => s.watchId === id);
  if (last && Date.now() - Date.parse(last.fetchedAt) < 10 * 60000)
    return {
      ok: false,
      error: "History was just refreshed. Try again in 10 minutes.",
    };
  const provider = radarProvider();
  if (!provider)
    return { ok: false, error: "Connect your INDmoney token in Vercel first." };
  try {
    const today = todayIST();
    const candles = await provider.history(item, today);
    const analysis = analyseRadar({
      candles,
      asset: item.assetType,
      today,
      expectedSession: null,
      adjustmentsVerified: false,
      priceBelow: item.priceBelow,
      drawdownPct: item.drawdownPct,
    });
    const { supabase, user } = await requireRadar();
    const { error } = await supabase.from("radar_snapshots").insert({
      user_id: user.id,
      watch_id: id,
      source: "INDstocks",
      session_date: analysis.asOf,
      engine_version: analysis.version,
      input_hash: createHash("sha256")
        .update(
          JSON.stringify({
            candles,
            inputs: analysis.inputs,
            version: analysis.version,
          }),
        )
        .digest("hex"),
      candles: candles as unknown as Json,
      analysis: analysis as unknown as Json,
    });
    if (error)
      return {
        ok: false,
        error: "Prices were read but couldn't be saved. Try again.",
      };
    revalidatePath("/radar", "layout");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Price history could not be refreshed.",
    };
  }
}
