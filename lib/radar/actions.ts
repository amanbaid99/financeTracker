"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { todayIST } from "@/lib/dates";
import type { Json } from "@/lib/supabase/database.types";
import type { EtfEvidence, MarketEvidence } from "./etf-data";
import { collectEtfEvidence, collectMarketEvidence } from "./etf-evidence";
import { previousCompletedSession } from "./calendar";
import { holdingReviewInputSchema } from "./holding-review";
import { ruleSettingsSchema } from "./rule-signal";
import { assetTypes, watchSchema } from "./contracts";
import { classifyInstrument, needsEtfEvidence, analysisAsset } from "./classification";
import { FinancialSourceError, financialSymbol, canReuseFinancials } from "./stock-financials";
import { analyseRadar } from "./analysis";
import {
  loadRadar,
  radarInstruments,
  radarProvider,
  radarFinancialProvider,
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
  const detected = classifyInstrument(instrument);
  const { error } = await supabase.from("radar_watchlist").insert({
    user_id: user.id,
    exchange: instrument.exchange,
    security_id: instrument.securityId,
    symbol: instrument.symbol,
    name: instrument.name,
    isin: instrument.isin,
    asset_type:
      !detected.needsReview && detected.asset && detected.asset !== "equity"
        ? detected.asset
        : v.data.assetType,
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
  assetType: (typeof assetTypes)[number];
  rulesEnabled: boolean;
  holdingConfirmed: boolean;
  sellAbove: number | null;
  sellBelow: number | null;
}) {
  const { supabase, user } = await requireRadar();
  const parsed = ruleSettingsSchema
    .safeExtend({ id: z.string().uuid(), assetType: z.enum(assetTypes) })
    .safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the thresholds.",
    };
  const v = parsed.data;
  const current = (await loadRadar()).items.find((i) => i.id === v.id);
  if (!current) return { ok: false, error: "Instrument not found." };
  if (
    current.classification &&
    !current.classification.needsReview &&
    current.classification.asset !== "equity" &&
    v.assetType !== current.classification.asset
  )
    return {
      ok: false,
      error:
        "The provider identifies this as an ETF. Keep its detected type and refresh research, or review the selected instrument.",
    };
  const { error } = await supabase
    .from("radar_watchlist")
    .update({
      asset_type: v.assetType,
      price_below: v.priceBelow,
      drawdown_pct: v.drawdownPct,
      rules_enabled: v.rulesEnabled,
      holding_confirmed: v.holdingConfirmed,
      sell_above: v.sellAbove,
      sell_below: v.sellBelow,
      rules_updated_at: new Date().toISOString(),
    })
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
    const now = new Date().toISOString();
    const candles = await provider.history(item, today);
    let etf: EtfEvidence | undefined;
    let market: MarketEvidence | undefined;
    if (needsEtfEvidence(item.assetType, item.classification)) {
      etf = await collectEtfEvidence({
        isin: item.isin,
        expectedSession: previousCompletedSession(today, item.exchange),
        now,
        readDepth: () => provider.depth(item, now),
      });
    }
    const marketRead = !etf
      ? collectMarketEvidence(() => provider.depth(item, now)).then((result) => { market = result; })
      : Promise.resolve();
    const analysis = analyseRadar({
      candles,
      asset: analysisAsset(item.assetType, item.classification),
      today,
      expectedSession: previousCompletedSession(today, item.exchange),
      adjustmentsVerified: false,
      priceBelow: item.priceBelow,
      drawdownPct: item.drawdownPct,
    });
    if (etf) analysis.etf = etf;
    const financialProvider = radarFinancialProvider();
    if (financialProvider && item.classification?.kind === "stock" && !item.classification.needsReview) {
      try {
        let master: Awaited<ReturnType<typeof radarInstruments>> | undefined;
        if (item.exchange === "BSE") master = await radarInstruments();
        const canonical = financialSymbol(item, master?.ok ? master.instruments : []);
        if (!canonical) throw new FinancialSourceError("This stock could not be mapped to one exact NSE ticker by ISIN. No company-name guess was used.");
        const previous = last?.analysis.financials;
        analysis.financials = canReuseFinancials(previous, canonical, now, item.isin)
          ? previous : await financialProvider.financials(canonical, today, now, item.isin);
      } catch (error) {
        if (error instanceof FinancialSourceError && error.identityShape) analysis.financialsIdentityShape = error.identityShape;
        analysis.financialsError = error instanceof FinancialSourceError
          ? error.message : "Company financial reports could not be read. Prices and trading checks are retained.";
      }
    }
    await marketRead;
    if (market) analysis.market = market;
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
            etf: analysis.etf ?? null,
            market: analysis.market ?? null,
            financials: analysis.financials ?? null,
            financialsError: analysis.financialsError ?? null,
            financialsIdentityShape: analysis.financialsIdentityShape ?? null,
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

export async function saveRadarHoldingReview(id: string, input: unknown) {
  const { supabase, user } = await requireRadar();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid watchlist item." };
  if (input === null) {
    const { error } = await supabase.from("radar_watchlist").update({ holding_review: null })
      .eq("id", id).eq("user_id", user.id).select("id").single();
    if (error) return { ok: false, error: "Couldn't remove the holding review." };
    revalidatePath("/radar", "layout");
    return { ok: true };
  }
  const parsed = holdingReviewInputSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Complete the review and confirm the details. Percentages must be between 0 and 100." };
  const item = (await loadRadar()).items.find((i) => i.id === id);
  if (!item?.isin || item.classification?.kind !== "stock" || item.classification.needsReview ||
      (!item.ownedInTracker && !item.rules?.holdingConfirmed))
    return { ok: false, error: "A confirmed stock holding with an exact ISIN is needed. Update your holdings first." };
  const { error } = await supabase.from("radar_watchlist")
    .update({ holding_review: { ...parsed.data, isin: item.isin, reviewedAt: new Date().toISOString() } })
    .eq("id", id).eq("user_id", user.id).select("id").single();
  if (error) return { ok: false, error: "Couldn't save the holding review. Try again." };
  revalidatePath("/radar", "layout");
  return { ok: true };
}
