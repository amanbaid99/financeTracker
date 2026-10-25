// The whole portfolio at a glance: what you hold by asset class and by kind
// of fund, and how much it has grown where the amount invested is known.

import { categoryLabel } from "./categories";
import { asKind, KIND_LABELS } from "./instruments";
import type { Investment } from "./tracker";

/** Asset classes in a fixed order; each keeps its chart colour slot. */
export const ASSET_CLASSES = [
  { key: "equity", label: "Equity", slot: 1 },
  { key: "debt", label: "Debt & fixed income", slot: 2 },
  { key: "hybrid", label: "Hybrid", slot: 3 },
  { key: "gold", label: "Gold", slot: 4 },
  { key: "cash", label: "Cash", slot: 5 },
  { key: "retirement", label: "Retirement (PPF, EPF, NPS)", slot: 6 },
  { key: "other", label: "Other", slot: 7 },
] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number]["key"];

const EQUITY = new Set([
  "equity_index",
  "flexi_cap",
  "large_cap",
  "mid_small_cap",
  "elss",
  "sectoral_thematic",
  "international",
  "direct_equity",
]);
const HYBRID = new Set([
  "aggressive_hybrid",
  "balanced_advantage",
  "multi_asset",
  "conservative_hybrid",
]);
const DEBT = new Set([
  "liquid_fund",
  "overnight_fund",
  "ultra_short_debt",
  "short_debt_fund",
  "corporate_bond",
  "gilt",
  "debt_fund",
  "arbitrage",
  "fd_rd",
  "sweep_fd",
]);

export function assetClassOf(
  i: Pick<Investment, "kind" | "category">,
): AssetClass {
  const kind = asKind(i.kind);
  if (kind === "stock") return "equity";
  if (kind === "savings") return "cash";
  if (kind === "fd") return "debt";
  if (kind === "gold") return "gold";
  if (kind === "ppf" || kind === "epf" || kind === "nps") return "retirement";
  const c = i.category ?? "";
  if (EQUITY.has(c)) return "equity";
  if (HYBRID.has(c)) return "hybrid";
  if (DEBT.has(c)) return "debt";
  if (c === "gold") return "gold";
  if (c === "savings_account") return "cash";
  return "other";
}

export interface PortfolioHolding {
  id: string;
  name: string;
  /** "Flexi-cap fund", "FD / RD"… */
  kindLabel: string;
  assetClass: AssetClass;
  value: number;
  monthlySip: number;
  share: number;
  invested: number | null;
  gain: number | null;
  gainPct: number | null;
}

export interface Portfolio {
  total: number;
  monthlySips: number;
  classes: {
    key: AssetClass;
    label: string;
    slot: number;
    value: number;
    share: number;
  }[];
  /** By kind of fund or holding, biggest first. */
  kinds: {
    label: string;
    assetClass: AssetClass;
    value: number;
    share: number;
  }[];
  holdings: PortfolioHolding[];
  /** Growth, over the holdings whose amount invested is known. */
  growth: {
    invested: number;
    value: number;
    gain: number;
    gainPct: number;
    known: number;
    of: number;
  } | null;
}

function kindLabel(i: Investment): string {
  const kind = asKind(i.kind);
  return kind === "mutual_fund" ? categoryLabel(i.category) : KIND_LABELS[kind];
}

function displayName(i: Investment): string {
  return i.name?.trim() || kindLabel(i);
}

const pct = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

export function buildPortfolio(investments: Investment[]): Portfolio {
  const live = investments.filter((i) => i.value > 0 || i.monthlySip > 0);
  const total = live.reduce((s, i) => s + i.value, 0);

  const holdings: PortfolioHolding[] = live
    .map((i) => {
      const invested = i.invested ?? null;
      const gain =
        invested !== null && invested > 0 ? i.value - invested : null;
      return {
        id: i.id,
        name: displayName(i),
        kindLabel: kindLabel(i),
        assetClass: assetClassOf(i),
        value: i.value,
        monthlySip: i.monthlySip,
        share: pct(i.value, total),
        invested,
        gain,
        gainPct: gain !== null && invested ? gain / invested : null,
      };
    })
    .sort((a, b) => b.value - a.value);

  const classes = ASSET_CLASSES.map((c) => {
    const value = holdings
      .filter((h) => h.assetClass === c.key)
      .reduce((s, h) => s + h.value, 0);
    return {
      key: c.key,
      label: c.label,
      slot: c.slot,
      value,
      share: pct(value, total),
    };
  }).filter((c) => c.value > 0);

  const byKind = new Map<
    string,
    { label: string; assetClass: AssetClass; value: number }
  >();
  for (const h of holdings) {
    const k = byKind.get(h.kindLabel) ?? {
      label: h.kindLabel,
      assetClass: h.assetClass,
      value: 0,
    };
    k.value += h.value;
    byKind.set(h.kindLabel, k);
  }
  const kinds = [...byKind.values()]
    .filter((k) => k.value > 0)
    .map((k) => ({ ...k, share: pct(k.value, total) }))
    .sort((a, b) => b.value - a.value);

  const known = holdings.filter((h) => h.gain !== null);
  const invested = known.reduce((s, h) => s + (h.invested ?? 0), 0);
  const knownValue = known.reduce((s, h) => s + h.value, 0);
  const growth = known.length
    ? {
        invested,
        value: knownValue,
        gain: knownValue - invested,
        gainPct: pct(knownValue - invested, invested),
        known: known.length,
        of: holdings.length,
      }
    : null;

  return {
    total,
    monthlySips: holdings.reduce((s, h) => s + h.monthlySip, 0),
    classes,
    kinds,
    holdings,
    growth,
  };
}

const SWATCH: Record<number, string> = {
  1: "bg-series-1",
  2: "bg-series-2",
  3: "bg-series-3",
  4: "bg-series-4",
  5: "bg-series-5",
  6: "bg-series-6",
  7: "bg-series-7",
};

/** Tailwind class for an asset class's chart colour slot. */
export const swatchFor = (slot: number) => SWATCH[slot] ?? "bg-muted-foreground";
