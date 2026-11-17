import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/data";
import { IndmoneyProvider } from "./indmoney";
import type {
  RadarAnalysis,
  RadarAsset,
  RadarSnapshot,
  WatchItem,
  Candle,
} from "./contracts";

export const radarAccess = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("radar_access")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  // A new feature must not break the existing shell while its migration is being deployed.
  return { enabled: !error && !!data, unavailable: !!error };
});
export async function requireRadar() {
  const access = await radarAccess();
  if (!access.enabled) notFound();
  return requireUser();
}
export function radarProvider() {
  const token = process.env.INDSTOCKS_ACCESS_TOKEN?.trim();
  return token ? new IndmoneyProvider(token) : null;
}
export const radarInstruments = cache(async () => {
  await requireRadar();
  const provider = radarProvider();
  if (!provider)
    return {
      ok: false as const,
      error: "Add INDSTOCKS_ACCESS_TOKEN in Vercel to connect INDmoney.",
    };
  try {
    return { ok: true as const, instruments: await provider.instruments() };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "INDmoney could not be reached.",
    };
  }
});
export const loadRadar = cache(async () => {
  const { supabase, user } = await requireRadar();
  const [watch, snapshots] = await Promise.all([
    supabase
      .from("radar_watchlist")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("radar_latest_snapshots"),
  ]);
  if (watch.error || snapshots.error)
    throw new Error("Your Radar could not be loaded. Try again.");
  const items: WatchItem[] = watch.data.map((r) => ({
    id: r.id,
    exchange: r.exchange as "NSE" | "BSE",
    securityId: r.security_id,
    symbol: r.symbol,
    name: r.name,
    isin: r.isin,
    assetType: r.asset_type as RadarAsset,
    priceBelow: r.price_below,
    drawdownPct: r.drawdown_pct,
    rules: {
      rulesEnabled: r.rules_enabled,
      holdingConfirmed: r.holding_confirmed,
      sellAbove: r.sell_above,
      sellBelow: r.sell_below,
      priceBelow: r.price_below,
      drawdownPct: r.drawdown_pct,
    },
  }));
  const history: RadarSnapshot[] = snapshots.data.map((r) => ({
    id: r.id,
    watchId: r.watch_id,
    fetchedAt: r.fetched_at,
    source: r.source,
    candles: r.candles as unknown as Candle[],
    analysis: r.analysis as unknown as RadarAnalysis,
  }));
  return { items, history };
});
